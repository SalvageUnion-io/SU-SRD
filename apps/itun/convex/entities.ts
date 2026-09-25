import { v } from 'convex/values'
import type { SoftLink } from '../src/lib/schemas/softLink'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { query } from './_generated/server'
import type { OwnableTable } from './model/entities'
import { findSoftLink, loadOwnable, mutation, parseBody } from './model/entities'
import {
  gameHasCrawler,
  getMembership,
  isTableRunner,
  NotAuthorized,
  requireMember,
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
 * what makes crew vitals possible and would let a read-only drill-in be
 * built (D12 — decided, not built).
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
 *
 * ## What lives elsewhere
 *
 * This module is the ownable-entity API: the reads, and the per-write mirror
 * the store calls on every edit. Three concerns that used to share it were
 * split out (audit AP-07), each into a module that says what it is:
 *
 *  - `claim.ts` — bringing a device's roster into an account (`claimLocal`,
 *    `repairContainers`).
 *  - `shelf.ts` — the shelf-only collections, saved patterns and the NPC tray.
 *  - `changeLog.ts` — the client's Change Log append.
 *
 * The block at the bottom of this file keeps their old `entities:*` paths
 * answering for one release — see "Transitional aliases" there.
 */

const OWNABLE = v.union(v.literal('pilots'), v.literal('mechs'))

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
 * Whether this user may add a new entity to this container.
 *
 * The shelf is unconditional: it is your own, so there is nobody to be set up
 * for and nothing to gate on. Inside a Game the answer depends on the crawler,
 * for the reason in the module header — with one exception, the table runner,
 * who is who *raises* the crawler.
 */
async function assertMayAddToContainer(
  ctx: QueryCtx | MutationCtx,
  gameId: Id<'games'> | null,
  userId: Id<'users'>
): Promise<void> {
  if (gameId === null) return

  const membership = await getMembership(ctx, gameId, userId)
  if (membership === null) throw new NotAuthorized('Not a member of this game')

  if (await isTableRunner(ctx, gameId, membership)) return

  if (!(await gameHasCrawler(ctx, gameId))) {
    throw new NotAuthorized(
      'This game has no Union Crawler yet — the Mediator raises one before the crew joins it'
    )
  }
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
        .withIndex('by_owner_game', (q) => q.eq('ownerId', userId))
        .collect(),
      ctx.db
        .query('mechs')
        .withIndex('by_owner_game', (q) => q.eq('ownerId', userId))
        .collect(),
      ctx.db
        .query('crawlers')
        .withIndex('by_owner_game', (q) => q.eq('ownerId', userId))
        .collect(),
      ctx.db
        .query('mechPatterns')
        .withIndex('by_owner_app_id', (q) => q.eq('ownerId', userId))
        .collect(),
      ctx.db
        .query('encounterNpcs')
        .withIndex('by_owner_app_id', (q) => q.eq('ownerId', userId))
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

/**
 * Delete an entity, addressed by its **server** id. Owner only.
 *
 * The twin of `removeByAppId`, which the mirror uses, and necessary because the
 * Game roster cannot use that one: it is looking at rows this browser may never
 * have held, and at pre-gens seeded from a template that have no `appId` at all
 * (production holds a dozen). Addressing by `_id` is the only way to name those,
 * and it is exactly how `ownership.release` and `removeCrawler` already
 * address a row from that surface.
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

    const body = parseBody('crawlers', args.body)

    return await ctx.db.insert('crawlers', {
      gameId: args.gameId,
      // Communal in a Game, owned on a shelf. Both-null is the invalid row, so
      // a shelf crawler MUST take an owner and the caller is the only candidate.
      ownerId: args.gameId === null ? userId : null,
      appId: args.appId,
      body,
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
 * The insert branch is a **create into a container**, so it answers to
 * `assertMayAddToContainer`. Leaving it open would have made the whole rule
 * cosmetic: this is the client's ordinary write path, so a player blocked from
 * adding to a Game would simply have built the pilot locally and had the
 * mirror place it there a moment later.
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
    const body = parseBody('crawlers', merged)

    await ctx.db.patch(existing._id, { body, updatedAt: Date.now() })
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

/* -------------------------------------------------------------------------- */
/* Transitional aliases                                                       */
/* -------------------------------------------------------------------------- */

/*
 * The functions AP-07 moved out of this module, still answering at their OLD
 * paths (`entities:claimLocal`, …) for one release.
 *
 * Convex deploys first and the client ships after it, and ITUN's service worker
 * is `registerType: 'prompt'` — a tab that was open across the deploy keeps
 * running the previous bundle until its user accepts the update, which can be
 * days. That bundle calls these by their old names. Without the aliases its
 * pattern and NPC saves would fail outright, its reconciler's claim would
 * error, and its Change Log rows — a fire-and-forget write — would be dropped
 * silently.
 *
 * The same registered function is exported twice; there is no second
 * implementation to drift. `tools/check-convex-callers.ts` sees these
 * re-exports as public functions and lists each in `ALLOWED_WITHOUT_CALLER`
 * with this reason, so they cannot outstay their welcome unnoticed: delete this
 * block and those entries together, in the first release after this one has
 * been in production long enough for stale tabs to have updated.
 */
export { appendChangeLog } from './changeLog'
export { claimLocal, repairContainers } from './claim'
export {
  removeEncounterNpc,
  removeMechPattern,
  upsertEncounterNpc,
  upsertMechPattern,
} from './shelf'
