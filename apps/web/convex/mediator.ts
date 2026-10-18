import { ConvexError, v } from 'convex/values'
import { MediatorRollResultSchema } from 'game-domain/schemas/encounterNpc'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { query } from './_generated/server'
import { displayNameOf } from './account'
import { bodyAppId, mutation, parseBody } from './model/entities'
import { NotAuthorized, requireMediator, requireUser } from './model/permissions'

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
 * ## There is no presence
 *
 * Who is at the table is not tracked. A presence reader ships with its writer
 * (a heartbeat some client calls) in the same change: a reader with no writer
 * shows "0 at the table" whoever is there, a permanently-false indicator, which
 * is worse than an absent one.
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
    await requireMediator(ctx, args.gameId)
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
    const { userId } = await requireMediator(ctx, args.gameId)
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
 * conditions, its name, or the last Morale roll made for it.
 *
 * Only these four fields, merged into the stored body and parsed before it is
 * written, like every other write to this table. HP is clamped to the
 * instance's own `maxHp` (and 0), so a stale tab cannot push it past either
 * end. A Morale result is stored here, on the NPC, and nowhere else: the
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
    }),
  },
  handler: async (ctx, args): Promise<void> => {
    const doc = await ctx.db.get(args.npcId)
    if (doc === null) throw new ConvexError('That NPC is no longer on the tray')
    await requireNpcWriter(ctx, doc)

    const body = doc.body as Record<string, unknown>
    const next: Record<string, unknown> = { ...body }
    const { currentHp, conditions, name, lastMediatorRoll } = args.patch
    if (currentHp !== undefined) {
      const max = typeof body.maxHp === 'number' ? body.maxHp : Number.POSITIVE_INFINITY
      next.currentHp = Math.min(Math.max(0, Math.round(currentHp)), max)
    }
    if (conditions !== undefined) next.conditions = conditions
    if (name !== undefined) {
      const trimmed = name.trim()
      if (trimmed.length === 0) throw new ConvexError('An NPC needs a name')
      next.name = trimmed
    }
    if (lastMediatorRoll !== undefined) {
      next.lastMediatorRoll = MediatorRollResultSchema.parse(lastMediatorRoll)
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
