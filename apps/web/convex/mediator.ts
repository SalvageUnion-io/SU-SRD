import { ConvexError, v } from 'convex/values'
import { runningFrom, splitWaves, trayNpcsFor, waveOf } from 'game-domain/games/encounters'
import { EncounterSchema, RunningEncounterSchema } from 'game-domain/schemas/encounter'
import { MediatorRollResultSchema } from 'game-domain/schemas/encounterNpc'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { query } from './_generated/server'
import { displayNameOf } from './account'
import { bodyAppId, mutation, parseBody } from './model/entities'
import { mediatorOrNull, NotAuthorized, requireMediator, requireUser } from './model/permissions'

/**
 * The Mediator surface's server layer (ADR-030 §6).
 *
 * ## The NPC tray is the one genuinely secret thing
 *
 * Everything else in a Game is readable by every member — that is what makes a
 * crew a crew. Prepared opposition is the exception, and it is the *only*
 * exception, so these queries gate on `requireMediator` rather than
 * `requireMember`. A player who can read the NPC tray can read the encounter
 * before it happens, which is the one leak that changes how the game is played
 * rather than merely who can edit what.
 *
 * ## The tray owes the same edge parse every other write does
 *
 * `encounterNpcs.body` is `v.any()`, so Convex cannot reject a malformed one —
 * `schema.ts` says in that many words that the mutation must, or the one table
 * only a Mediator can see is the one nothing validates. `parseBody` is shared with
 * `entities.ts`; what it accepts here is deliberately looser than the local
 * store's record, and `model/entities.ts` says why.
 */

/** The Mediator's prepared opposition. Mediator-only, by design. */
export const npcs = query({
  args: { gameId: v.id('games') },
  returns: v.array(v.object({ _id: v.id('encounterNpcs'), body: v.any() })),
  handler: async (ctx, args) => {
    if ((await mediatorOrNull(ctx, args.gameId)) === null) return []
    const rows = await ctx.db
      .query('encounterNpcs')
      .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
      .collect()
    return rows.map((r) => ({ _id: r._id, body: r.body }))
  },
})

/**
 * The saved mech patterns the Mediator may field as opposition: their own,
 * and every pattern its maker shared with this Game's crew. A pattern kept to
 * "Only me" by somebody else stays theirs. Mediator-only, like the tray.
 */
export const patterns = query({
  args: { gameId: v.id('games') },
  returns: v.array(v.object({ appId: v.string(), body: v.any(), madeBy: v.string() })),
  handler: async (ctx, args) => {
    const membership = await mediatorOrNull(ctx, args.gameId)
    if (membership === null) return []
    const { userId } = membership
    const [mine, shared] = await Promise.all([
      ctx.db
        .query('mechPatterns')
        .withIndex('by_owner_app_id', (q) => q.eq('ownerId', userId))
        .collect(),
      ctx.db
        .query('mechPatterns')
        .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
        .collect(),
    ])
    const theirs = shared.filter((row) => row.ownerId !== userId)
    const makers = await Promise.all(theirs.map((row) => ctx.db.get(row.ownerId)))
    return [
      ...mine.map((row) => ({ appId: row.appId, body: row.body, madeBy: 'You' })),
      ...theirs.map((row, i) => ({
        appId: row.appId,
        body: row.body,
        madeBy: displayNameOf(makers[i] ?? null, 'A crewmate'),
      })),
    ]
  },
})

export const addNpc = mutation({
  args: { gameId: v.id('games'), body: v.any() },
  handler: async (ctx, args): Promise<Id<'encounterNpcs'>> => {
    await requireMediator(ctx, args.gameId)
    const body = parseBody('encounterNpcs', args.body)
    // The body's id is the row's address: minted here when the body has none,
    // so the `appId` column and `body.id` stay one value.
    const appId = bodyAppId(body) ?? crypto.randomUUID()
    // `ownerId: null` is what in-a-Game means for a tray NPC — the opposition
    // belongs to the table, and the Mediator reaches it through their role.
    // The shelf tray is written by `shelf.upsertEncounterNpc`.
    return await ctx.db.insert('encounterNpcs', {
      gameId: args.gameId,
      ownerId: null,
      appId,
      body: { ...(body as Record<string, unknown>), id: appId },
    })
  },
})

export const removeNpc = mutation({
  args: { npcId: v.id('encounterNpcs') },
  handler: async (ctx, args): Promise<void> => {
    const doc = await ctx.db.get(args.npcId)
    if (doc === null) return
    await requireNpcWriter(ctx, doc)
    await ctx.db.delete(args.npcId)
  },
})

/**
 * Change one tray NPC as the fight goes: its HP or SP, its
 * conditions, its name, the last Morale roll made for it, what it tracks as
 * an important NPC (Workshop Manual p.255: EP, Heat and its last Critical
 * roll or Heat Check), or the claim on its wreck once it is down and salvaged.
 *
 * Only these fields, merged into the stored body and parsed before it is
 * written, like every other write to this table. HP is clamped to the
 * instance's own `maxHp` (and 0), EP to its `maxEp` and Heat to its
 * `heatCap`, so a stale tab cannot push one past either end. A Morale result is stored here, on the NPC, and nowhere else: the
 * Game's log is crew-readable, and the tray is the one thing ADR-030 §5 hides.
 */
export const updateNpc = mutation({
  args: {
    npcId: v.id('encounterNpcs'),
    patch: v.object({
      currentHp: v.optional(v.number()),
      conditions: v.optional(v.array(v.string())),
      name: v.optional(v.string()),
      lastMediatorRoll: v.optional(v.any()),
      /** Claim a downed wreck's salvage: refused once claimed, or while it still stands. */
      salvaged: v.optional(v.literal(true)),
      important: v.optional(v.boolean()),
      /** The chassis's EP and Heat Capacity, frozen when it is marked important. */
      maxEp: v.optional(v.number()),
      heatCap: v.optional(v.number()),
      currentEp: v.optional(v.number()),
      currentHeat: v.optional(v.number()),
      lastImportantRoll: v.optional(v.any()),
    }),
  },
  handler: async (ctx, args): Promise<void> => {
    const doc = await ctx.db.get(args.npcId)
    if (doc === null) throw new ConvexError('That NPC is no longer on the tray')
    await requireNpcWriter(ctx, doc)

    const body = doc.body as Record<string, unknown>
    const next: Record<string, unknown> = { ...body }
    const { currentHp, conditions, name, lastMediatorRoll, important, maxEp, heatCap } = args.patch
    const { currentEp, currentHeat, lastImportantRoll, salvaged } = args.patch
    const clampTo = (value: number, max: unknown) =>
      Math.min(Math.max(0, Math.round(value)), typeof max === 'number' ? max : Infinity)
    if (currentHp !== undefined) next.currentHp = clampTo(currentHp, body.maxHp)
    if (important !== undefined) next.important = important
    if (maxEp !== undefined) next.maxEp = clampTo(maxEp, Infinity)
    if (heatCap !== undefined) next.heatCap = clampTo(heatCap, Infinity)
    if (currentEp !== undefined) next.currentEp = clampTo(currentEp, next.maxEp)
    if (currentHeat !== undefined) next.currentHeat = clampTo(currentHeat, next.heatCap)
    if (conditions !== undefined) next.conditions = conditions
    if (name !== undefined) {
      const trimmed = name.trim()
      if (trimmed.length === 0) throw new ConvexError('An NPC needs a name')
      next.name = trimmed
    }
    if (lastMediatorRoll !== undefined) {
      next.lastMediatorRoll = MediatorRollResultSchema.parse(lastMediatorRoll)
    }
    if (salvaged !== undefined) {
      // The claim before the haul is written, as `downtime.claimStep` is: a
      // second tab, or a second press, never pays out the same wreck twice.
      if (body.salvaged === true) throw new ConvexError('That wreck is already salvaged')
      if (typeof next.currentHp === 'number' && next.currentHp > 0) {
        throw new ConvexError('Only a downed wreck can be salvaged')
      }
      next.salvaged = true
    }
    if (lastImportantRoll !== undefined) {
      next.lastImportantRoll = MediatorRollResultSchema.parse(lastImportantRoll)
    }
    if (typeof body.updatedAt === 'string') next.updatedAt = new Date().toISOString()

    await ctx.db.patch(doc._id, { body: parseBody('encounterNpcs', next) })
  },
})

/**
 * Who may write an NPC — it depends on which container holds it.
 *
 * In a Game, the Mediator and nobody else: the tray is the one thing §5 keeps
 * hidden from the crew, so the read rule and the write rule are the same rule.
 * On a shelf it is an ordinary owned record and only its owner may touch it.
 *
 * Split out rather than inlined at both call sites, because a
 * container-dependent rule written twice is a rule that will eventually be
 * written two different ways — the same reason `entities.ts` has
 * `assertMayEditCrawler`.
 */
async function requireNpcWriter(ctx: MutationCtx, doc: Doc<'encounterNpcs'>): Promise<void> {
  if (doc.gameId !== null) {
    await requireMediator(ctx, doc.gameId)
    return
  }
  const userId = await requireUser(ctx)
  if (doc.ownerId !== userId) {
    throw new NotAuthorized("You cannot edit another player's NPC")
  }
}

/**
 * Whether the caller mediates this Game.
 *
 * A plain query rather than something derived client-side from the roster, so
 * a surface can gate itself on one authoritative answer instead of
 * reconstructing the rule. Returns false rather than throwing for a
 * non-member — "can I mediate this" is a reasonable question for anyone to ask.
 */
export const amMediator = query({
  args: { gameId: v.id('games') },
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    const userId = await requireUser(ctx)
    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_game_user', (q) => q.eq('gameId', args.gameId).eq('userId', userId))
      .unique()
    return membership?.mediator ?? false
  },
})

/**
 * The encounter this Game is running (ADR-059): its name, tables and notes,
 * or null when none is. Mediator-only, like the tray it was run into.
 */
export const running = query({
  args: { gameId: v.id('games') },
  // The body, parsed when it was written, or null.
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireMediator(ctx, args.gameId)
    const row = await runningRow(ctx, args.gameId)
    return row?.body ?? null
  },
})

/**
 * Run one of the caller's shelf encounters in this Game (ADR-059): its
 * opposition joins the tray as fresh NPCs at full HP or SP, named apart from
 * those already there, and its name, tables and notes become the Game's
 * running encounter, in place of any it was running. The shelf encounter is
 * copied, never moved, so it stays as it was built.
 *
 * `clear` empties the tray first. It is the Mediator's own choice, made in
 * the dialog that names what it removes (ADR-007); nothing is cleared for them.
 *
 * `waves` (ADR-059 §5, sent while the `encounterSheet` flag is on) fields only
 * the first wave, each opponent with its group; the groups held back wait on
 * the running encounter for `bringInWave`. Without it the whole opposition
 * joins the tray, ungrouped.
 */
export const runEncounter = mutation({
  args: {
    gameId: v.id('games'),
    encounterId: v.string(),
    clear: v.boolean(),
    waves: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ added: number }> => {
    const { userId } = await requireMediator(ctx, args.gameId)
    const row = await ctx.db
      .query('encounters')
      .withIndex('by_owner_app_id', (q) => q.eq('ownerId', userId).eq('appId', args.encounterId))
      .first()
    if (row === null) throw new ConvexError('That encounter is not on your shelf')
    const encounter = EncounterSchema.parse(row.body)

    const tray = await ctx.db
      .query('encounterNpcs')
      .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
      .collect()
    if (args.clear) for (const npc of tray) await ctx.db.delete(npc._id)
    const taken = args.clear ? [] : tray.map((npc) => nameOf(npc.body))

    const now = new Date().toISOString()
    const waves = args.waves === true ? splitWaves(encounter) : null
    const fielded = waves
      ? trayNpcsFor(waves.first, taken, now, encounter.groups ?? [])
      : trayNpcsFor(encounter.opposition, taken, now)
    await field(ctx, args.gameId, fielded)

    const body = RunningEncounterSchema.parse(
      runningFrom(encounter, now, waves ? { held: waves.held } : undefined)
    )
    const current = await runningRow(ctx, args.gameId)
    if (current === null) await ctx.db.insert('runningEncounters', { gameId: args.gameId, body })
    else await ctx.db.patch(current._id, { body })
    return { added: fielded.length }
  },
})

/**
 * Bring a held-back wave of the running encounter onto the tray (ADR-059 §5):
 * its opponents join at full HP or SP, each with its group, named apart from
 * those already there. The Mediator's tap, never the server's: nothing
 * arrives on its own.
 */
export const bringInWave = mutation({
  args: { gameId: v.id('games'), wave: v.number() },
  handler: async (ctx, args): Promise<{ added: number }> => {
    await requireMediator(ctx, args.gameId)
    const current = await runningRow(ctx, args.gameId)
    if (current === null) throw new ConvexError('No encounter is running')
    const running = RunningEncounterSchema.parse(current.body)
    const groups = running.groups ?? []
    const held = running.held ?? []
    const arriving = held.filter((o) => waveOf(o, groups) === args.wave)
    if (arriving.length === 0) throw new ConvexError('That wave is already in')

    const tray = await ctx.db
      .query('encounterNpcs')
      .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
      .collect()
    const fielded = trayNpcsFor(
      arriving,
      tray.map((npc) => nameOf(npc.body)),
      new Date().toISOString(),
      groups
    )
    await field(ctx, args.gameId, fielded)

    const { held: _held, ...rest } = running
    const left = held.filter((o) => waveOf(o, groups) !== args.wave)
    const body = RunningEncounterSchema.parse(left.length === 0 ? rest : { ...rest, held: left })
    await ctx.db.patch(current._id, { body })
    return { added: fielded.length }
  },
})

/**
 * Record one roll for a whole group on the tray (Core Book p.267-268): the
 * book rolls Reaction when the Pilots meet a group, and checks a group's
 * Morale when half of it falls. The same result is kept on each of its
 * members still standing, as each NPC keeps its own last roll.
 */
export const recordGroupRoll = mutation({
  args: { gameId: v.id('games'), groupId: v.string(), roll: v.any() },
  handler: async (ctx, args): Promise<void> => {
    await requireMediator(ctx, args.gameId)
    const roll = MediatorRollResultSchema.parse(args.roll)
    const tray = await ctx.db
      .query('encounterNpcs')
      .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
      .collect()
    const now = new Date().toISOString()
    for (const npc of tray) {
      const body = npc.body as Record<string, unknown>
      const group = body.group as { id?: unknown } | undefined
      const hp = body.currentHp
      if (group?.id !== args.groupId || (typeof hp === 'number' && hp <= 0)) continue
      const next: Record<string, unknown> = { ...body, lastMediatorRoll: roll }
      if (typeof body.updatedAt === 'string') next.updatedAt = now
      await ctx.db.patch(npc._id, { body: parseBody('encounterNpcs', next) })
    }
  },
})

/** Put fresh NPCs on a Game's tray, each its own row with a minted id. */
async function field(
  ctx: MutationCtx,
  gameId: Id<'games'>,
  npcs: ReturnType<typeof trayNpcsFor>
): Promise<void> {
  for (const npc of npcs) {
    const appId = crypto.randomUUID()
    await ctx.db.insert('encounterNpcs', {
      gameId,
      ownerId: null,
      appId,
      body: parseBody('encounterNpcs', { ...npc, id: appId }),
    })
  }
}

/**
 * Stop running the Game's encounter: its notes and tables leave Play. The
 * Opposition it fielded stays on the tray, each NPC the Mediator's to remove.
 */
export const endEncounter = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args): Promise<void> => {
    await requireMediator(ctx, args.gameId)
    const current = await runningRow(ctx, args.gameId)
    if (current !== null) await ctx.db.delete(current._id)
  },
})

/** The Game's running-encounter row, one at most. */
async function runningRow(ctx: QueryCtx | MutationCtx, gameId: Id<'games'>) {
  return await ctx.db
    .query('runningEncounters')
    .withIndex('by_game', (q) => q.eq('gameId', gameId))
    .first()
}

/** A tray body's name, read without trusting its shape. */
function nameOf(body: unknown): string {
  const name = (body as { name?: unknown } | null)?.name
  return typeof name === 'string' ? name : ''
}
