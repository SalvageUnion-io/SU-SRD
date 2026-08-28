import { v } from 'convex/values'
import { CrawlerSchema } from '../src/lib/schemas/crawler'
import type { EntityRef } from '../src/lib/schemas/entity'
import { EntityRefSchema } from '../src/lib/schemas/entity'
import type { SoftLink } from '../src/lib/schemas/softLink'
import { SoftLinkSchema } from '../src/lib/schemas/softLink'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import type { OwnableTable } from './model/entities'
import { loadOwnable, PARSERS, parseBody } from './model/entities'
import {
  gameHasCrawler,
  getMembership,
  isTableRunner,
  NotAuthorized,
  requireMember,
  requireMemberAs,
  requireTableRunner,
  requireUser,
} from './model/permissions'
import { entityRefType, softLinkType } from './schema'

/**
 * Entity reads and writes against the server of record (ADR-030 §1).
 *
 * ## Every write Zod-parses before it persists
 *
 * The schema stores entity bodies as `v.any()` so the Zod schemas in
 * `src/lib/schemas/` stay the single source of truth rather than being forked
 * into a second, hand-maintained set of Convex validators. The price of that is
 * stated plainly in the schema header: **Convex cannot reject a malformed body,
 * so the mutation has to.** `parseBody` and its `PARSERS` map live in
 * `model/entities.ts` so every module that writes a body pays it the same way.
 *
 * ## What you may read, and what you may write
 *
 * Reading is per-Game: any member sees every pilot and mech in it, which is
 * what makes crew vitals and read-only drill-in possible (D12).
 *
 * Writing is per-*entity*: only the owner writes their own pilot, and nobody
 * writes a crewmate's. A Mediator wanting to change someone else's sheet goes
 * through a proposal (D7), not through here — there is deliberately no
 * privileged write path in this module.
 *
 * The crawler is the exception on both axes, because it is communal (D8): any
 * member may write it, resolved by field-level merge rather than
 * last-write-wins, since the scrap pool and cargo lots are genuinely contended
 * during Downtime.
 *
 * ## Who may put things *into* a Game
 *
 * Communal-to-edit is not the same as free-to-create, and the crawler is where
 * the two come apart. **Raising and scrapping a crawler is the table runner's
 * act; filling its fields is everyone's.** That split is what makes a Game a
 * table rather than a shared folder: the Mediator sets out what the crew sails
 * in, and the crew then keeps its scrap, cargo and bays between them.
 *
 * The mirror image is the gate on players: a Game with no crawler is not yet
 * set up, so a player's pilots and mechs wait until there is one. The table
 * runner is exempt for the obvious reason — somebody has to be able to raise
 * the first crawler, and a rule that stopped them would make every new Game a
 * dead end.
 */

const OWNABLE = v.union(v.literal('pilots'), v.literal('mechs'))

/*
 * Soft-link kind guards, asked of the Zod schemas rather than of a copied list,
 * so the Convex unions in `schema.ts` and the local schemas cannot drift apart
 * without one of these failing.
 */

/** Whether `value` is an endpoint kind `EntityRefSchema` allows. */
function isEntityRefType(value: unknown): value is EntityRef['type'] {
  return EntityRefSchema.shape.type.safeParse(value).success
}

/** Whether `value` is a relationship kind `SoftLinkSchema` allows. */
function isSoftLinkType(value: unknown): value is SoftLink['type'] {
  return SoftLinkSchema.shape.type.safeParse(value).success
}

/**
 * Who may write an entity.
 *
 * Synchronous and ctx-free on purpose: the answer depends only on the row's
 * own `ownerId`. There is deliberately no lookup that could grant a Mediator a
 * privileged write here — changing someone else's sheet goes through a
 * proposal (D7), and giving this function a ctx would invite exactly that.
 */
function assertMayWrite(doc: Doc<'pilots'> | Doc<'mechs'>, userId: Id<'users'>): void {
  if (doc.ownerId === userId) return
  if (doc.ownerId === null) {
    throw new NotAuthorized(
      'That entity is unclaimed — it must be assigned before it can be edited'
    )
  }
  throw new NotAuthorized("You cannot edit another player's entity")
}

/**
 * Whether this user may add a new entity to this Game, and as whom.
 *
 * The shelf is unconditional: it is your own, so there is nobody to be set up
 * for and nothing to gate on. Inside a Game the answer depends on the crawler,
 * for the reason in the module header — with one exception, the table runner,
 * who is who *raises* the crawler.
 *
 * Returns whether the caller is the table runner rather than a bare boolean
 * pass/fail, because the caller immediately needs that same answer to decide
 * whether an `unassigned` create is allowed. Asking twice would mean two
 * lookups and, worse, two places the rule could drift.
 */
async function assertMayAddToContainer(
  ctx: QueryCtx | MutationCtx,
  gameId: Id<'games'> | null,
  userId: Id<'users'>
): Promise<{ tableRunner: boolean }> {
  if (gameId === null) return { tableRunner: false }

  const membership = await getMembership(ctx, gameId, userId)
  if (membership === null) throw new NotAuthorized('Not a member of this game')

  const tableRunner = await isTableRunner(ctx, gameId, membership)
  if (tableRunner) return { tableRunner }

  if (!(await gameHasCrawler(ctx, gameId))) {
    throw new NotAuthorized(
      'This game has no Union Crawler yet — the Mediator raises one before the crew joins it'
    )
  }
  return { tableRunner }
}

/** Everything in a Game the caller can see: all pilots and mechs, plus the crawler. */
export const listForGame = query({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.gameId)

    const [pilots, mechs, crawlers, softLinks] = await Promise.all([
      ctx.db
        .query('pilots')
        .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
        .collect(),
      ctx.db
        .query('mechs')
        .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
        .collect(),
      ctx.db
        .query('crawlers')
        .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
        .collect(),
      ctx.db
        .query('softLinks')
        .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
        .collect(),
    ])

    /**
     * `appId` travels with every row because the client's copy of an entity is
     * addressed by it, not by `_id`. Without it a surface cannot answer "do I
     * already hold this one locally?", and the honest answer to that question
     * is what decides whether a row offers a sheet link or an offer to pick it
     * up. It is not secret — it is a UUID the owner's own browser minted.
     */
    return {
      pilots: pilots.map((p) => ({
        _id: p._id,
        appId: p.appId ?? null,
        ownerId: p.ownerId,
        body: p.body,
      })),
      mechs: mechs.map((m) => ({
        _id: m._id,
        appId: m.appId ?? null,
        ownerId: m.ownerId,
        body: m.body,
      })),
      crawlers: crawlers.map((c) => ({ _id: c._id, appId: c.appId ?? null, body: c.body })),
      softLinks: softLinks.map((l) => ({ _id: l._id, from: l.from, to: l.to, type: l.type })),
    }
  },
})

/**
 * Create an entity, on the caller's shelf or in a Game they belong to.
 *
 * `unassigned` is how a Mediator pre-builds a character **for somebody else**:
 * the row lands with `ownerId: null` and any player in the Game may pick it up
 * (`ownership.claim`). It is the create-time twin of a template's pre-gens, and
 * it is table-runner-only for the same reason assignment is — an ownerless
 * entity is an offer to the crew, and a player making one would be dropping
 * their own character into the pool rather than offering anything.
 */
/**
 * Everything this account owns, for filling the local cache.
 *
 * ## Why this did not exist, and why that was a bug
 *
 * Writes have mirrored **up** since ADR-030, but nothing ever read back **down**
 * outside a Game (`listForGame`). The consequence is not subtle: a signed-in
 * player opening ITUN on a second device saw an **empty roster**. Their builds
 * were in Convex the whole time; there was simply no query that would return
 * them. The only path down was `claimLocal`, which is for pushing a local roster
 * up, and `GameRoster`, which is scoped to one Game.
 *
 * That is the gap that makes "IndexedDB is a cache" untrue as a description: a
 * cache is something that can be *filled*, and until this there was nothing to
 * fill it from ([ADR-034](../../../docs/adrs/ADR-034-account-required-persistence.md)
 * decision 2).
 *
 * ## Owned, not shelved
 *
 * Deliberately every row the caller **owns**, whether it is on their shelf or
 * in a Game, rather than the shelf alone. A Game entity you own is still yours
 * and still belongs on your roster; scoping this to `gameId === null` would make
 * a build vanish from the local cache the moment it was taken into a campaign,
 * and reappear when the campaign ended.
 *
 * Unclaimed rows are excluded by construction — they have no `ownerId`, so the
 * index cannot return them. That is right: an unclaimed pre-gen sitting in a
 * Game belongs to the Game's view (`listForGame`), not to anybody's roster.
 *
 * The crawler is included on the same rule, which is only expressible at all
 * because #871 gave it an owner.
 */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx)

    const [pilots, mechs, crawlers, patterns, npcs] = await Promise.all([
      ctx.db
        .query('pilots')
        .withIndex('by_owner', (q) => q.eq('ownerId', userId))
        .collect(),
      ctx.db
        .query('mechs')
        .withIndex('by_owner', (q) => q.eq('ownerId', userId))
        .collect(),
      ctx.db
        .query('crawlers')
        .withIndex('by_owner', (q) => q.eq('ownerId', userId))
        .collect(),
      ctx.db
        .query('mechPatterns')
        .withIndex('by_owner', (q) => q.eq('ownerId', userId))
        .collect(),
      ctx.db
        .query('encounterNpcs')
        .withIndex('by_owner', (q) => q.eq('ownerId', userId))
        .collect(),
    ])

    // Bodies only. The caller is filling a local store whose records are keyed
    // by the app-level id inside the body, so a Convex `_id` would be noise —
    // and `appId` rides along separately for the rows that carry one, because
    // that is what the mirror addresses by.
    return {
      pilots: pilots.map((r) => ({ appId: r.appId ?? null, body: r.body })),
      mechs: mechs.map((r) => ({ appId: r.appId ?? null, body: r.body })),
      crawlers: crawlers.map((r) => ({ appId: r.appId ?? null, body: r.body })),
      mechPatterns: patterns.map((r) => ({ body: r.body })),
      // Without this the shelf tray was WRITE-ONLY. `claimLocal` and
      // `games.destroy` both wrote `encounterNpcs`, and no query read them
      // back: `mediator.npcs` requires a `gameId`, so a tray on a shelf was
      // reachable by nothing. It went up and never came down.
      encounterNpcs: npcs.map((r) => ({ body: r.body })),
    }
  },
})

export const create = mutation({
  args: {
    table: OWNABLE,
    gameId: v.union(v.id('games'), v.null()),
    /** The local UUID this row mirrors, so later edits can address it. */
    appId: v.optional(v.string()),
    /** Table-runner only: land it unclaimed for a player to pick up. */
    unassigned: v.optional(v.boolean()),
    body: v.any(),
  },
  handler: async (ctx, args): Promise<Id<'pilots'> | Id<'mechs'>> => {
    const userId = await requireUser(ctx)
    const { tableRunner } = await assertMayAddToContainer(ctx, args.gameId, userId)
    const body = parseBody(args.table, args.body)

    // `gameId: null && ownerId: null` is the one invalid combination in the
    // schema — a shelf is a *person's*, so an unclaimed shelf entity would be
    // owned by nobody and reachable by nobody.
    if (args.unassigned === true && args.gameId === null) {
      throw new NotAuthorized('A shelf has no crew to pick anything up — shelved builds are yours')
    }
    if (args.unassigned === true && !tableRunner) {
      throw new NotAuthorized('Only the Mediator can leave a new character unclaimed')
    }

    return await ctx.db.insert(args.table, {
      gameId: args.gameId,
      ownerId: args.unassigned === true ? null : userId,
      appId: args.appId,
      body,
      updatedAt: Date.now(),
    })
  },
})

/** Replace an entity's body. Owner only — see the module header. */
export const update = mutation({
  args: {
    table: OWNABLE,
    entityId: v.string(),
    body: v.any(),
  },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx)
    const doc = await loadOwnable(ctx, args.table, args.entityId)

    assertMayWrite(doc, userId)
    const body = parseBody(args.table, args.body)

    await ctx.db.patch(doc._id, { body, updatedAt: Date.now() })
  },
})

/**
 * Delete an entity, addressed by its **server** id. Owner only.
 *
 * The twin of `removeByAppId`, which the mirror uses, and necessary because the
 * Game roster cannot use that one: it is looking at rows this browser may never
 * have held, and at pre-gens seeded from a template that have no `appId` at all
 * (production holds a dozen). Addressing by `_id` is the only way to name those,
 * and it is exactly how `update`, `ownership.release` and `removeCrawler`
 * already address a row from that surface.
 */
export const remove = mutation({
  args: { table: OWNABLE, entityId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx)
    const doc = await loadOwnable(ctx, args.table, args.entityId)

    assertMayWrite(doc, userId)
    await ctx.db.delete(doc._id)
    if (doc.appId !== undefined) await pruneSoftLinksFor(ctx, doc.appId)
  },
})

/**
 * Raise a Union Crawler in this Game. Table runner only.
 *
 * A Game may hold **several** crawlers, and that is not a leniency — a long
 * campaign genuinely runs more than one: a crawler is lost or scrapped and the
 * crew rebuilds, or a second one is met, escorted and eventually joined. The
 * schema never said one, and forcing it here would make the ordinary course of
 * a campaign look like a bug.
 *
 * There is deliberately no `unassigned` axis **inside a Game**: a crawler there
 * carries `ownerId: null`, which is exactly what communal means (D8). It
 * belongs to the crew from the moment it exists, which is why players may fill
 * in its fields without ever being handed it.
 *
 * ## `gameId: null` raises one on your own shelf
 *
 * A crawler can now also live on a shelf (`schema.ts`), and that is the only
 * case where it has an owner. There is no table to run, so there is no table
 * runner to require and no crew to be communal with — the caller is simply the
 * owner. This is the path the local mirror uses for a Solo crawler, which
 * previously had no server row at all.
 */
export const createCrawler = mutation({
  args: {
    /** The Game this crawler is raised in, or `null` to raise it on your shelf. */
    gameId: v.union(v.id('games'), v.null()),
    /** The local UUID this row mirrors — see `pilots.appId`. */
    appId: v.optional(v.string()),
    body: v.any(),
  },
  handler: async (ctx, args): Promise<Id<'crawlers'>> => {
    const userId = await requireUser(ctx)
    if (args.gameId !== null) await requireTableRunner(ctx, args.gameId)

    const result = CrawlerSchema.safeParse(args.body)
    if (!result.success) {
      throw new Error(`Invalid crawler payload: ${result.error.issues[0]?.message ?? 'unknown'}`)
    }

    return await ctx.db.insert('crawlers', {
      gameId: args.gameId,
      // Communal in a Game, owned on a shelf. Both-null is the invalid row, so
      // a shelf crawler MUST take an owner and the caller is the only candidate.
      ownerId: args.gameId === null ? userId : null,
      appId: args.appId,
      body: result.data,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Scrap a crawler. Table runner only — the mirror of raising one.
 *
 * Communal editing does **not** extend to destruction: the crawler is the
 * crew's home and every pilot in the Game is anchored to it, so one member
 * deleting it would take the table's shared state with them. Whoever runs the
 * table decides a crawler is gone.
 */
export const removeCrawler = mutation({
  args: { crawlerId: v.id('crawlers') },
  handler: async (ctx, args): Promise<void> => {
    const doc = await ctx.db.get(args.crawlerId)
    if (doc === null) return
    await assertMayScrapCrawler(ctx, doc)
    await ctx.db.delete(args.crawlerId)
  },
})

/**
 * Who may write a crawler's body — it depends on which container holds it.
 *
 * In a Game the crawler is communal (D8), so **any member** may edit it; that
 * is the whole point of a shared home and it is why crawler edits resolve by
 * field-level merge rather than by an ownership check. On a shelf there is no
 * crew to share with, so it is an ordinary owned entity and only its owner may
 * touch it.
 *
 * Split out from the two call sites rather than inlined at each, because a
 * container-dependent rule written twice is a rule that will eventually be
 * written two different ways.
 */
async function assertMayEditCrawler(ctx: MutationCtx, doc: Doc<'crawlers'>): Promise<void> {
  if (doc.gameId !== null) {
    await requireMember(ctx, doc.gameId)
    return
  }
  const userId = await requireUser(ctx)
  if (doc.ownerId !== userId) {
    throw new NotAuthorized("You cannot edit another player's crawler")
  }
}

/**
 * Who may scrap a crawler. Stricter than editing one, on both sides.
 *
 * In a Game, destruction is the **table runner's** act and communal editing
 * deliberately does not extend to it: the crawler is the crew's home and every
 * pilot is anchored to it, so one member deleting it would take the table's
 * shared state with them. On a shelf the owner decides, exactly as they do for
 * their own pilots and mechs.
 */
async function assertMayScrapCrawler(ctx: MutationCtx, doc: Doc<'crawlers'>): Promise<void> {
  if (doc.gameId !== null) {
    await requireTableRunner(ctx, doc.gameId)
    return
  }
  const userId = await requireUser(ctx)
  if (doc.ownerId !== userId) {
    throw new NotAuthorized("You cannot scrap another player's crawler")
  }
}

/**
 * Whether this table already holds a row carrying this app id.
 *
 * Deliberately `.first()` and not `.unique()`, which is the opposite of
 * `byAppId` two hundred lines down, and the difference is the point: this
 * function's job is to run correctly **on a table that is already duplicated**.
 * `.unique()` throws when it finds more than one row, so using it here would
 * make the claim that repairs nothing also fail outright on exactly the accounts
 * that need repairing most.
 *
 * Existence is asked without reference to who owns the row. A row with this app
 * id belonging to somebody else is still a reason not to insert: `byAppId` is a
 * **global** lookup, so a second row would break the mirror for both accounts
 * rather than one. See the note on app-id collisions in `claimLocal`.
 */
async function appIdTaken(
  ctx: MutationCtx,
  table: 'pilots' | 'mechs' | 'crawlers',
  appId: string
): Promise<boolean> {
  const existing = await ctx.db
    .query(table)
    .withIndex('by_app_id', (q) => q.eq('appId', appId))
    .first()
  return existing !== null
}

/**
 * Upload local entities into this account on first sign-in (D11).
 *
 * Everything lands on the **shelf**, never straight into a Game. A person
 * signing in for the first time has local builds with no relationship to any
 * crew, and guessing one would be worse than making them place it deliberately.
 *
 * Bodies are Zod-parsed like any other write, and a row that fails is **skipped
 * rather than aborting the claim**. A single corrupt local record should not
 * cost somebody their whole roster — the count of skipped rows comes back so
 * the UI can say what did not make it.
 *
 * ## Claiming twice is now a no-op, and it has to be
 *
 * Every insert below is guarded on identity, because this mutation is **not**
 * called once per account no matter how the UI is written. The only thing that
 * used to stop a second run was a `localStorage` marker on one device, and the
 * card that writes it is deliberately re-offered on a second device — so a
 * player signing in on their laptop after their phone, or in a fresh browser
 * profile, or after clearing site data, ran the whole claim again.
 *
 * The consequence was not a cosmetic double-up. Pilots, mechs and crawlers are
 * addressed by `appId`, and the lookups that address them (`byAppId`,
 * `patchCrawlerByAppId`) use `.unique()`, which **throws** on a second row.
 * From the moment a roster was claimed twice, every mirrored write for those
 * entities failed with an opaque server error, silently and permanently: the
 * local write still succeeded, so the app looked fine while IndexedDB and the
 * declared server of record drifted apart for good. That is the failure this
 * guard exists to make impossible, and a client-side marker was never the right
 * place to enforce it — the damage is server-side and forever, so the check
 * belongs here.
 *
 * Identity per kind: `appId` for pilots, mechs and crawlers; the
 * (from, to, kind) triple for soft links; the body's own id for patterns.
 *
 * ## The residual sharp edge: app ids are not globally unique
 *
 * `appId` is a UUID the client minted, and export/import copies a build between
 * people **keeping its id**. Two accounts can therefore legitimately hold the
 * same app id, which the `by_app_id` + `.unique()` pairing assumes cannot
 * happen. This mutation takes the safe side of that — an app id already present
 * anywhere is reported as `alreadyPresent` rather than inserted, so a claim can
 * decline to copy a build instead of corrupting the mirror for two people. That
 * is a real limitation, not a fix; closing it means keying the index on
 * (ownerId, appId), which is a schema change and its own piece of work.
 */
export const claimLocal = mutation({
  args: {
    pilots: v.array(v.any()),
    mechs: v.array(v.any()),
    crawlers: v.optional(v.array(v.any())),
    softLinks: v.optional(v.array(v.any())),
    mechPatterns: v.optional(v.array(v.any())),
    /**
     * The player's own NPC tray.
     *
     * Newly claimable, and only because P0 gave `encounterNpcs` the two
     * container columns: before that an NPC could exist only inside a Game, so
     * there was nowhere for a claimed one to land and it was silently dropped —
     * the same gap the crawler had before #871.
     */
    encounterNpcs: v.optional(v.array(v.any())),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    claimed: number
    skipped: number
    alreadyPresent: number
    byKind: Record<string, number>
  }> => {
    const userId = await requireUser(ctx)
    const now = Date.now()
    let claimed = 0
    let skipped = 0
    let alreadyPresent = 0
    const byKind: Record<string, number> = {}

    const bump = (kind: string) => {
      byKind[kind] = (byKind[kind] ?? 0) + 1
      claimed += 1
    }

    for (const [table, rows] of [
      ['pilots', args.pilots],
      ['mechs', args.mechs],
    ] as const) {
      for (const body of rows) {
        const parsed = PARSERS[table].safeParse(body)
        if (!parsed.success) {
          skipped += 1
          continue
        }
        const appId =
          typeof (body as { id?: unknown }).id === 'string'
            ? (body as { id: string }).id
            : undefined

        if (appId !== undefined && (await appIdTaken(ctx, table, appId))) {
          alreadyPresent += 1
          continue
        }

        await ctx.db.insert(table, {
          gameId: null,
          ownerId: userId,
          appId,
          body: parsed.data,
          updatedAt: now,
        })
        bump(table)
      }
    }

    /**
     * Crawlers, soft links and patterns are claimed too.
     *
     * The first version of this mutation took only pilots and mechs, which
     * silently dropped the crawler — the crew's HOME — along with every
     * pilot-to-crawler and mech-to-pilot link that makes a roster a roster, and
     * every saved pattern. Somebody claiming a long-running solo campaign would
     * have watched half of it vanish with no error.
     *
     * ## This used to invent a container, and no longer needs to
     *
     * A claimed crawler had no Game to go in and no shelf able to hold it, so
     * it was parked on a placeholder **"Claimed crawler" Game of one** — an
     * entire Game, plus a membership in it, raised solely to satisfy a
     * non-nullable `gameId`. That is gone: `crawlers` now carries the same two
     * container columns as `pilots` and `mechs`, so a claimed crawler lands
     * exactly where a claimed pilot lands, on the claimer's shelf.
     *
     * Two problems go with it. The placeholder appeared in the player's games
     * list as a table they never made and could not meaningfully use; and the
     * ordering dance that raised it lazily — resolving what to write BEFORE
     * inserting the Game, so that a re-claim with nothing new to say did not
     * leave an empty one behind — was load-bearing machinery guarding a
     * workaround. With no Game to raise there is nothing left to order, so the
     * crawler pass is now the same straight loop the pilots and mechs use.
     */
    for (const body of args.crawlers ?? []) {
      const parsed = CrawlerSchema.safeParse(body)
      if (!parsed.success) {
        skipped += 1
        continue
      }
      const appId =
        typeof (body as { id?: unknown }).id === 'string' ? (body as { id: string }).id : undefined
      if (appId !== undefined && (await appIdTaken(ctx, 'crawlers', appId))) {
        alreadyPresent += 1
        continue
      }
      await ctx.db.insert('crawlers', {
        gameId: null,
        ownerId: userId,
        appId,
        body: parsed.data,
        updatedAt: now,
      })
      bump('crawlers')
    }

    /**
     * The NPC tray claims onto the shelf, like everything else here.
     *
     * `ownerId: userId` with `gameId: null` — a tray on a shelf is owned, while
     * a tray in a Game is the Mediator's and owned by nobody. Claiming produces
     * the first of those, always: a claim has no Game to put anything in.
     */
    for (const body of args.encounterNpcs ?? []) {
      // `PARSERS.encounterNpcs` rather than the schema directly — that map is
      // the single list of tables owing an edge parse, and reaching around it is
      // how a table ends up validated two different ways.
      const parsed = PARSERS.encounterNpcs.safeParse(body)
      if (!parsed.success) {
        skipped += 1
        continue
      }
      await ctx.db.insert('encounterNpcs', {
        gameId: null,
        ownerId: userId,
        body: parsed.data,
      })
      bump('encounterNpcs')
    }

    for (const link of args.softLinks ?? []) {
      const l = link as {
        from?: { type?: string; id?: string }
        to?: { type?: string; id?: string }
        type?: string
      }
      /*
       * Endpoint kinds and the link kind are checked here rather than coerced.
       * They used to be waved through — `String(l.from.type ?? '')` wrote an
       * empty string for a link with no endpoint kind — and the schema, which
       * now declares both as closed unions, would refuse that write outright.
       * A link this claim cannot honour takes the same `skipped` path a
       * malformed one already did: the rest of the payload still lands.
       */
      if (
        typeof l.from?.id !== 'string' ||
        typeof l.to?.id !== 'string' ||
        !isEntityRefType(l.from.type) ||
        !isEntityRefType(l.to.type) ||
        !isSoftLinkType(l.type)
      ) {
        skipped += 1
        continue
      }
      /*
       * A soft link has no `appId` of its own — it IS its endpoints — so
       * identity is the (from, to, kind) triple, and that is what a re-claim
       * has to match on. Duplicates here are less destructive than a duplicate
       * entity but they are not harmless: `listForGame` returns every row, so a
       * roster would draw the same mech-to-pilot link twice.
       *
       * Shares `findSoftLink` with the mirror mutations below rather than
       * repeating the lookup inline — the triple is the link's identity in both
       * places, and two copies of that rule could disagree.
       */
      // Bound into locals: the checks above narrowed `l.from`/`l.to`, but that
      // narrowing does not survive the `await` below.
      const from = { type: l.from.type, id: l.from.id }
      const to = { type: l.to.type, id: l.to.id }
      const linkType = l.type

      if ((await findSoftLink(ctx, from.id, to.id, linkType)) !== null) {
        alreadyPresent += 1
        continue
      }

      // `gameId: null` — the shelf, matching the entities these link. It used to
      // be the placeholder Game's id whenever a crawler happened to be claimed in
      // the same call, which filed a shelf roster's wiring under a Game the player
      // never made.
      await ctx.db.insert('softLinks', { gameId: null, from, to, type: linkType })
      bump('softLinks')
    }

    /*
     * Patterns are the one claimed kind with no `appId` column at all, so the
     * repeat-claim check reads the id out of the body and compares against this
     * user's own patterns. `by_owner` keeps that to one indexed read of a set
     * that is per-person and small — a pattern is a saved mech loadout, not a
     * log.
     */
    const ownPatterns =
      (args.mechPatterns ?? []).length > 0
        ? await ctx.db
            .query('mechPatterns')
            .withIndex('by_owner', (q) => q.eq('ownerId', userId))
            .collect()
        : []
    const ownPatternIds = new Set(
      ownPatterns
        .map((row) => (row.body as { id?: unknown }).id)
        .filter((id): id is string => typeof id === 'string')
    )

    for (const body of args.mechPatterns ?? []) {
      // Patterns are parsed like every other claimed body. They were the one
      // kind that went in unread, which made `mechPatterns.body` the only
      // `v.any()` column in the schema nothing ever validated.
      const parsed = PARSERS.mechPatterns.safeParse(body)
      if (!parsed.success) {
        skipped += 1
        continue
      }
      const patternId = (body as { id?: unknown }).id
      if (typeof patternId === 'string' && ownPatternIds.has(patternId)) {
        alreadyPresent += 1
        continue
      }
      if (typeof patternId === 'string') ownPatternIds.add(patternId)

      await ctx.db.insert('mechPatterns', {
        ownerId: userId,
        gameId: null,
        body: parsed.data,
      })
      bump('mechPatterns')
    }

    return { claimed, skipped, alreadyPresent, byKind }
  },
})

/**
 * Look a row up by the app-level UUID the client holds.
 *
 * This is the whole point of the `appId` column: a client that only knows its
 * local UUID can still address the server row, so updates and deletes work
 * without a mapping table. One indexed lookup, not a scan.
 *
 * ## Why this tolerates duplicates instead of asking for `.unique()`
 *
 * `by_app_id` is an ordinary Convex index, **not a uniqueness constraint** —
 * nothing in the database has ever stopped two rows sharing an `appId`, and in
 * production several did (`claimLocal` blind-inserts, and its only guard is a
 * per-device localStorage marker, so claiming the same shelf from a second
 * browser duplicates the roster).
 *
 * `.unique()` turned that *data* condition into a thrown `Server Error` on
 * every subsequent mirrored write. `mirrorWrite` is fire-and-forget, so it
 * swallowed the throw: the local copy went on accepting edits, the server never
 * heard another one, and the two silently diverged forever — with the entity
 * still rendering perfectly on the shelf that had already saved it. That is the
 * worst failure this app can produce, and it was reachable from a duplicate row.
 *
 * A duplicate is a repair job. It is not a reason to refuse the write that
 * would have kept client and server in step, so this resolves one row and lets
 * the write land.
 *
 * **The oldest row wins, deterministically.** It is the row every earlier
 * mirror already wrote to, so choosing it keeps editing the copy the client has
 * been addressing all along rather than silently migrating to a younger one.
 * `_creationTime` is used rather than index order because index order is not a
 * documented guarantee, and a winner that moves between calls would be worse
 * than the throw it replaces.
 */
async function byAppId(
  ctx: MutationCtx,
  table: OwnableTable,
  appId: string
): Promise<Doc<'pilots'> | Doc<'mechs'> | null> {
  const matches = (await ctx.db
    .query(table)
    .withIndex('by_app_id', (q) => q.eq('appId', appId))
    .collect()) as Array<Doc<'pilots'> | Doc<'mechs'>>

  if (matches.length === 0) return null
  if (matches.length === 1) return matches[0] ?? null

  // Logged every time rather than silently absorbed: the write now succeeds, so
  // this line is the only remaining signal that a roster needs de-duplicating.
  // It lands in the deployment log stream, which is the one place a Convex
  // server-side message is readable at all (there is no Sentry SDK in here).
  console.warn(
    `[itun] ${matches.length} ${table} rows share appId="${appId}" — resolving to the oldest; this roster needs de-duplicating`
  )

  return matches.reduce((oldest, row) => (row._creationTime < oldest._creationTime ? row : oldest))
}

/**
 * Mirror a local write to the server of record, addressed by app id.
 *
 * Upsert rather than update: the row may not exist yet if the entity was
 * created while Solo and the account was claimed afterwards. Treating a missing
 * row as "create it" is what makes the mirror converge instead of silently
 * dropping the first edit after a claim.
 *
 * The insert branch is a **create into a container**, so it answers to the same
 * gate `create` does. Leaving it open would have made the whole rule cosmetic:
 * the client's ordinary write path comes through here, so a player blocked from
 * `create` would simply have built the pilot locally and had the mirror place
 * it in the Game a moment later.
 */
export const upsertByAppId = mutation({
  args: {
    table: OWNABLE,
    appId: v.string(),
    gameId: v.union(v.id('games'), v.null()),
    body: v.any(),
  },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx)
    const body = parseBody(args.table, args.body)

    const existing = await byAppId(ctx, args.table, args.appId)
    if (existing === null) {
      await assertMayAddToContainer(ctx, args.gameId, userId)
      await ctx.db.insert(args.table, {
        gameId: args.gameId,
        ownerId: userId,
        appId: args.appId,
        body,
        updatedAt: Date.now(),
      })
      return
    }

    assertMayWrite(existing, userId)

    /**
     * A mirrored write also re-homes the row when the client has moved it.
     *
     * Until this existed, `MoveToContainerControl` re-stamped the local record
     * and the mirror patched only the body — so moving a build onto a Game
     * looked like it worked, the roster filtered by the new container, and the
     * server row never left the shelf. The move is a create *into* the target
     * container as far as the rules are concerned, so it answers to the same
     * gate; leaving the source is unconditional.
     */
    if (existing.gameId !== args.gameId) {
      await assertMayAddToContainer(ctx, args.gameId, userId)
      await ctx.db.patch(existing._id, { gameId: args.gameId })
    }

    await ctx.db.patch(existing._id, { body, updatedAt: Date.now() })
  },
})

/**
 * Mirror a local crawler write, addressed by app id, as a **field-level merge**
 * (D19).
 *
 * The crawler needs its own mirror because it is the one entity whose local
 * edits are legitimate from *any* member — "players can only edit fields" is
 * only true end to end if those edits actually arrive.
 *
 * Last-write-wins would be wrong here in a way that shows up on exactly the
 * night it matters: during Downtime the whole crew touches the crawler within
 * the same few minutes, and a full-body write would silently discard whichever
 * member happened to lose the race. Merging per top-level field means two
 * people editing different things both succeed, and only a genuine same-field
 * collision contends.
 *
 * Unlike the ownable tables this **never inserts**. A missing row means the
 * crawler is not in this Game — either it is a purely local build (Solo, or on
 * the shelf, neither of which has a server row to reach) or it was scrapped by
 * the table runner. Creating one here would route around the rule that raising
 * a crawler is the table runner's act, which is precisely the hole the ownable
 * upsert had to be closed against.
 */
export const patchCrawlerByAppId = mutation({
  args: { appId: v.string(), patch: v.any() },
  handler: async (ctx, args): Promise<void> => {
    const existing = await crawlerByAppId(ctx, args.appId)
    if (existing === null) return

    await assertMayEditCrawler(ctx, existing)

    const merged = { ...(existing.body as Record<string, unknown>), ...(args.patch as object) }
    const result = CrawlerSchema.safeParse(merged)
    if (!result.success) {
      throw new Error(`Invalid crawler payload: ${result.error.issues[0]?.message ?? 'unknown'}`)
    }

    await ctx.db.patch(existing._id, { body: result.data, updatedAt: Date.now() })
  },
})

/** Scrap a crawler addressed by app id. Table runner only, like `removeCrawler`. */
export const removeCrawlerByAppId = mutation({
  args: { appId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const existing = await crawlerByAppId(ctx, args.appId)
    if (existing === null) return

    await assertMayScrapCrawler(ctx, existing)
    await ctx.db.delete(existing._id)
  },
})

/**
 * The crawler mirroring a local build, addressed by app id.
 *
 * Tolerant of duplicates for exactly the reasons `byAppId` is — same
 * non-unique index, same fire-and-forget mirror, same silent divergence if it
 * throws. The crawler has no duplicates in production today, and that is luck
 * rather than a constraint: `claimLocal` inserts one per claim, so a second
 * claim from a second device would have produced them here too.
 */
async function crawlerByAppId(ctx: MutationCtx, appId: string): Promise<Doc<'crawlers'> | null> {
  const matches = await ctx.db
    .query('crawlers')
    .withIndex('by_app_id', (q) => q.eq('appId', appId))
    .collect()

  if (matches.length === 0) return null
  if (matches.length === 1) return matches[0] ?? null

  console.warn(
    `[itun] ${matches.length} crawlers share appId="${appId}" — resolving to the oldest; this game needs de-duplicating`
  )

  return matches.reduce((oldest, row) => (row._creationTime < oldest._creationTime ? row : oldest))
}

/**
 * The server row for a soft link, addressed the way the client addresses one.
 *
 * Soft links carry no `appId` and need none: `from.id` and `to.id` already ARE
 * app-level ids, so the (from, to, kind) triple is the link's identity. Two
 * links with the same endpoints and the same kind are the same link, whichever
 * browser drew it — which is what makes the mirror idempotent for free.
 */
async function findSoftLink(
  ctx: MutationCtx,
  fromId: string,
  toId: string,
  type: SoftLink['type']
): Promise<Doc<'softLinks'> | null> {
  const candidates = await ctx.db
    .query('softLinks')
    .withIndex('by_from', (q) => q.eq('from.id', fromId))
    .collect()

  return candidates.find((l) => l.to.id === toId && l.type === type) ?? null
}

/**
 * Which ownable table a link's `from` endpoint lives in.
 *
 * The `from` end is always ownable — a mech in `mech-to-pilot`, a pilot in
 * `pilot-to-crawler` — which is what lets one lookup answer both questions the
 * mirror has to ask: may this user draw the link, and which container does it
 * belong to.
 */
const SOFT_LINK_FROM_TABLE: Record<SoftLink['type'], OwnableTable> = {
  'mech-to-pilot': 'mechs',
  'pilot-to-crawler': 'pilots',
}

/**
 * Mirror a soft link to the server of record.
 *
 * ## Why this exists
 *
 * Soft links were the one part of a roster that never left the browser.
 * `mirrorEntityWrite` returned early for them — they were called "derived", and
 * for a shelf they effectively are — while `listForGame` *read* them back. So a
 * Game showed whatever links existed when the account was claimed, and every
 * wiring change made afterwards was invisible to the rest of the table: you
 * assigned a pilot to the crawler, your own sheet updated, and nobody else ever
 * saw it. A link is not derived once a Game shares it; it is the assignment.
 *
 * ## Permission and container both come from the `from` end
 *
 * You may draw a link out of an entity you may write, and the link lands in
 * that entity's container. Both fall out of one lookup, and both are the
 * answers you want: wiring your own mech to a crewmate's pilot is your business
 * because the mech is yours, and the link belongs wherever the mech does.
 *
 * A `from` entity with no server row means a purely local build — Solo, or
 * shelved before a claim — so there is nothing to anchor a link to and this
 * no-ops rather than inventing one.
 */
/**
 * Append client-originated Change Log rows (ADR-022 / ADR-034 P4b).
 *
 * The Change Log is what ADR-030 calls "the spine of this feature", and until
 * this existed it was **two disconnected spines**. `entityStore.emitChangeLog`
 * terminated at `db.changeLog.append` — IndexedDB — while the server table was
 * written only by `ownership`, `proposals` and `botClient`. Each drawer showed
 * half the history, and clearing site data destroyed the client half outright
 * because Convex held no copy.
 *
 * Rows land `state: 'applied'` and `actorId: userId`. A client append is a
 * record of something that ALREADY happened locally, not a request — the
 * proposal lifecycle (`proposed`/`declined`/`superseded`) belongs to
 * `proposals.ts` and is deliberately not reachable from here.
 *
 * Batched because the local emitter already batches: one edit that touches
 * three fields is three rows, and sending them individually would triple the
 * round trips on the hot path.
 */
export const appendChangeLog = mutation({
  args: {
    entries: v.array(
      v.object({
        gameId: v.union(v.id('games'), v.null()),
        entityType: v.union(
          v.literal('pilot'),
          v.literal('mech'),
          v.literal('crawler'),
          v.literal('softLink'),
          v.literal('game')
        ),
        entityId: v.string(),
        ts: v.number(),
        kind: v.union(v.literal('transaction'), v.literal('override'), v.literal('manual')),
        field: v.string(),
        before: v.any(),
        after: v.any(),
        source: v.string(),
      })
    ),
  },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx)

    // `alert` is the Mediator's broadcast channel, not a field a client may
    // append. `proposals.broadcast` writes those rows behind `requireMediator`,
    // and `proposals.alerts` returns every one of them to every member of the
    // game — so without this line any signed-in user could post a message into
    // the whole crew's alert feed, carrying a real `actorId`, by calling this
    // mutation instead. The gate on the intended path is only a gate if the
    // unintended one is closed too.
    const alert = args.entries.find((e) => e.field === 'alert')
    if (alert !== undefined) {
      throw new NotAuthorized('Alerts are written by the Mediator, not by a client append')
    }

    // Membership is checked per distinct game, not per entry.
    //
    // Every field of an entry is client-supplied, `gameId` included, and
    // nothing here derived it from a record the caller can be shown to own. A
    // user who has left a game — or who holds its id from an unredeemed invite
    // link — could therefore write rows into that game's log indefinitely, and
    // `proposals.alerts`/the Change Log drawer would render them as genuine
    // provenance attributed to them.
    //
    // Distinct rather than per-entry because the batch is usually one edit
    // touching several fields of ONE entity: deduplicating keeps this at one
    // membership read for the common case rather than one per row, which
    // preserves the round-trip argument the comment below makes.
    const gameIds = [...new Set(args.entries.flatMap((e) => (e.gameId === null ? [] : [e.gameId])))]
    await Promise.all(gameIds.map((gameId) => requireMemberAs(ctx, gameId, userId)))

    // `Promise.all` rather than a serial loop: these are independent inserts and
    // this runs on every sheet edit, so the round trips are the cost.
    await Promise.all(
      args.entries.map((e) =>
        ctx.db.insert('changeLog', {
          gameId: e.gameId,
          entityType: e.entityType,
          entityId: e.entityId,
          ts: e.ts,
          kind: e.kind,
          field: e.field,
          before: e.before,
          after: e.after,
          source: e.source,
          actorId: userId,
          state: 'applied',
        })
      )
    )
  },
})

/**
 * Mirror one saved pattern, addressed by the id inside its body.
 *
 * These tables have no `appId` column and need none: a pattern's own id already
 * is its app id, which makes this naturally idempotent — the same write twice
 * is a patch, not a duplicate.
 *
 * Until this existed, `mechPatterns` reached Convex through exactly one path,
 * the bulk `claimLocal` at sign-in. Every pattern saved afterwards lived only in
 * that browser: invisible on a second device, and gone with the site data. This
 * is the per-write half ADR-034 P4b calls for.
 */
export const upsertMechPattern = mutation({
  args: { body: v.any() },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx)
    const parsed = PARSERS.mechPatterns.parse(args.body)
    const patternId = (args.body as { id?: unknown }).id
    if (typeof patternId !== 'string') {
      throw new Error('[itun] a mech pattern must carry a string id in its body')
    }

    const own = await ctx.db
      .query('mechPatterns')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .collect()
    const existing = own.find((r) => (r.body as { id?: unknown }).id === patternId)

    if (existing === undefined) {
      await ctx.db.insert('mechPatterns', { ownerId: userId, gameId: null, body: parsed })
      return
    }
    await ctx.db.patch(existing._id, { body: parsed })
  },
})

/** Delete one saved pattern. Scoped to the caller's own rows by construction. */
export const removeMechPattern = mutation({
  args: { patternId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx)
    const own = await ctx.db
      .query('mechPatterns')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .collect()
    const existing = own.find((r) => (r.body as { id?: unknown }).id === args.patternId)
    // Absent is success: a delete that races a delete, or a row that never
    // reached the server, must not fail the local write that follows it.
    if (existing === undefined) return
    await ctx.db.delete(existing._id)
  },
})

/**
 * Mirror one shelf NPC.
 *
 * Shelf only — `ownerId: userId`, `gameId: null`. A tray inside a Game belongs
 * to the table rather than to a member and is reached through `mediator.*` by
 * the Mediator's role; this is the personal tray, which is the one the local
 * store holds and the one that had no server write at all.
 */
export const upsertEncounterNpc = mutation({
  args: { body: v.any() },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx)
    const parsed = PARSERS.encounterNpcs.parse(args.body)
    const npcId = (args.body as { id?: unknown }).id
    if (typeof npcId !== 'string') {
      throw new Error('[itun] an encounter NPC must carry a string id in its body')
    }

    const own = await ctx.db
      .query('encounterNpcs')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .collect()
    const existing = own.find((r) => (r.body as { id?: unknown }).id === npcId)

    if (existing === undefined) {
      await ctx.db.insert('encounterNpcs', { gameId: null, ownerId: userId, body: parsed })
      return
    }
    await ctx.db.patch(existing._id, { body: parsed })
  },
})

/** Delete one shelf NPC. Absent is success, as for patterns. */
export const removeEncounterNpc = mutation({
  args: { npcId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx)
    const own = await ctx.db
      .query('encounterNpcs')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .collect()
    const existing = own.find((r) => (r.body as { id?: unknown }).id === args.npcId)
    if (existing === undefined) return
    await ctx.db.delete(existing._id)
  },
})

export const upsertSoftLink = mutation({
  args: {
    from: v.object({ type: entityRefType, id: v.string() }),
    to: v.object({ type: entityRefType, id: v.string() }),
    type: softLinkType,
  },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx)

    const anchor = await byAppId(ctx, SOFT_LINK_FROM_TABLE[args.type], args.from.id)
    if (anchor === null) return
    assertMayWrite(anchor, userId)

    const existing = await findSoftLink(ctx, args.from.id, args.to.id, args.type)
    if (existing !== null) {
      // The link is already here; only its container can have moved, and it
      // moves with the entity it was drawn out of.
      if (existing.gameId !== anchor.gameId) {
        await ctx.db.patch(existing._id, { gameId: anchor.gameId })
      }
      return
    }

    await ctx.db.insert('softLinks', {
      gameId: anchor.gameId,
      from: args.from,
      to: args.to,
      type: args.type,
    })
  },
})

/** Unwire a soft link. Addressed by endpoints; already-gone is not an error. */
export const removeSoftLink = mutation({
  args: {
    from: v.object({ type: entityRefType, id: v.string() }),
    to: v.object({ type: entityRefType, id: v.string() }),
    type: softLinkType,
  },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx)

    const anchor = await byAppId(ctx, SOFT_LINK_FROM_TABLE[args.type], args.from.id)
    if (anchor === null) return
    assertMayWrite(anchor, userId)

    const existing = await findSoftLink(ctx, args.from.id, args.to.id, args.type)
    if (existing === null) return

    await ctx.db.delete(existing._id)
  },
})

/** Delete by app id. A row that is already gone is not an error. */
export const removeByAppId = mutation({
  args: { table: OWNABLE, appId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx)
    const existing = await byAppId(ctx, args.table, args.appId)
    if (existing === null) return

    assertMayWrite(existing, userId)
    await ctx.db.delete(existing._id)
    await pruneSoftLinksFor(ctx, args.appId)
  },
})

/**
 * Drop every link with this entity on either end.
 *
 * The client has cascaded this since well before Games existed
 * (`deleteEntityWithSoftLinks`), and the server not doing the same is how a
 * Game accumulates wires to characters that are gone — rendered as the "Unknown
 * pilot (id)" rows the local cascade was written to abolish. Both ends are
 * swept because a link is directional but a deletion is not.
 */
async function pruneSoftLinksFor(ctx: MutationCtx, appId: string): Promise<void> {
  const [outgoing, incoming] = await Promise.all([
    ctx.db
      .query('softLinks')
      .withIndex('by_from', (q) => q.eq('from.id', appId))
      .collect(),
    ctx.db
      .query('softLinks')
      .withIndex('by_to', (q) => q.eq('to.id', appId))
      .collect(),
  ])

  await Promise.all([...outgoing, ...incoming].map((link) => ctx.db.delete(link._id)))
}
