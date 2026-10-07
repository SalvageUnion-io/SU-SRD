import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import { CROSS_CONTAINER_REFUSAL, endsMatchType } from '../src/lib/links/linkRules'
import type { SoftLink } from '../src/lib/schemas/softLink'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { query } from './_generated/server'
import type { ContainedRow, OwnableTable } from './model/entities'
import {
  assignToPrimary,
  crawlerEnteredGame,
  crawlerLeftGame,
  findSoftLink,
  linkIdOf,
  loadOwnable,
  mutation,
  parseBody,
  primaryCrawlerOf,
  pruneLinksAcrossContainers,
  pruneLinksOfRow,
  resolveLinkEnd,
  rowsInGame,
  sameContainerRows,
  unsetCrawlerFields,
  writeSoftLink,
} from './model/entities'
import {
  getMembership,
  isTableRunner,
  NotAuthorized,
  requireMember,
  requireTableRunner,
  requireUser,
} from './model/permissions'
import { releaseSeatsOf } from './model/seats'
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
 * The crawler is the exception, because it belongs to the crew rather than to
 * a player: in a Game **only the table runner** writes it — the Mediator, or
 * the Organizer while the Game has none (ADR-038 §5). Players read it and ask
 * at the table. Writes still resolve by field-level merge rather than
 * last-write-wins, so a field the client did not touch is never overwritten.
 *
 * ## Who may put things *into* a Game
 *
 * The crawler is the table runner's from end to end: **raising, editing and
 * scrapping it are all theirs.** The Mediator sets out what the crew sails in
 * and keeps its scrap, cargo and bays (ADR-038 §5).
 *
 * Pilots and mechs are the other way round: **any member may bring their own
 * into any Game they belong to**, crawler or no crawler. There used to be a
 * gate — a player's builds waited until the table runner had raised one — and
 * it is gone (ADR-037): the crew can gather first, and the first crawler to
 * arrive becomes the **primary** and picks up everybody without one. Whoever
 * enters a Game that already has a primary is assigned to it on the way in, by
 * an explicit link the server writes as part of the add or the move.
 *
 * Moving a crawler is the table runner's act in both directions
 * (`moveCrawler`): from their own shelf into the Game, or out of it onto their
 * own shelf, where it becomes theirs.
 *
 * ## What lives elsewhere
 *
 * This module is the ownable-entity API: the reads, and the per-write mirror
 * the store calls on every edit. Three concerns that used to share it were
 * split out (audit AP-07), each into a module that says what it is:
 *
 *  - `claim.ts` — bringing a device's roster into an account (`claimLocal`).
 *  - `shelf.ts` — the shelf-only collections, saved patterns and the NPC tray.
 *  - `changeLog.ts` — the client's Change Log append.
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
export function assertMayWrite(doc: Doc<'pilots'> | Doc<'mechs'>, userId: Id<'users'>): void {
  if (doc.ownerId === userId) return
  if (doc.ownerId === null) {
    throw new NotAuthorized(
      'That entity is unclaimed — it must be assigned before it can be edited'
    )
  }
  throw new NotAuthorized("You cannot edit another player's entity")
}

/**
 * Whether this user may add a pilot or mech to this container — by creating it
 * there or moving their own in.
 *
 * The shelf is unconditional: it is your own. A Game takes a member's builds
 * whether or not it has a crawler yet (ADR-037 dropped that gate); being a
 * member is the whole rule.
 */
async function assertMayAddToContainer(
  ctx: QueryCtx | MutationCtx,
  gameId: Id<'games'> | null,
  userId: Id<'users'>
): Promise<void> {
  if (gameId === null) return
  const membership = await getMembership(ctx, gameId, userId)
  if (membership === null) throw new NotAuthorized('Not a member of this game')
}

/** Everything in a Game the caller can see: all pilots and mechs, plus the crawler. */
export const listForGame = query({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.gameId)

    const [pilots, mechs, crawlers, softLinks, primary] = await Promise.all([
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
      primaryCrawlerOf(ctx, args.gameId),
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
      // The same link shape `listWiring` serves, so the read-only sheet store
      // turns these into local `SoftLink`s through the one adapter
      // (`softLinkFromServer`) the sync already uses.
      softLinks: softLinks.map((l) => ({
        _id: l._id,
        _creationTime: l._creationTime,
        gameId: l.gameId,
        from: l.from,
        to: l.to,
        type: l.type,
      })),
      /** The crawler new crew is assigned to (ADR-037), or null before one exists. */
      primaryCrawlerId: primary?._id ?? null,
    }
  },
})

const LOCATE_TABLE = { pilot: 'pilots', mech: 'mechs', crawler: 'crawlers' } as const

/**
 * Where one sheet lives and whether the caller may edit it — the question the
 * live sheet route (`/sheet/$kind/$id`) asks of anything this browser does not
 * hold, and of anything it does, to learn which Game to read alongside it.
 *
 * `id` is what the client addresses an entity by: its app id, or — for a
 * template-seeded pre-gen, which has none — the id in its body. A Convex row
 * id is accepted too, because that is what the retired crew-view URL
 * (`/games/$gameId/view/$kind/$rowId`, still in the Discord bot's replies)
 * carried; `id` in the answer is always the client's, so the route can put the
 * canonical address back in the bar.
 *
 * Visibility is exactly `listForGame`'s and `listMine`'s together: your own
 * rows wherever they are, and every row in a Game you belong to. Anything else
 * — a stranger's shelf, a Game you left — is `null`, the same answer as no row
 * at all. `gameId` is the Game whose listing renders it, so it is set only for
 * a Game the caller belongs to. `mayEdit` mirrors the write rules: a pilot or
 * mech is its owner's (`assertMayWrite`), a crawler in a Game its table
 * runner's (`assertMayEditCrawler`, ADR-038 §5).
 *
 * Returns `null` rather than throwing when signed out, because a reactive
 * query that throws takes the route's error boundary with it.
 */
export const locate = query({
  args: { kind: entityRefType, id: v.string() },
  handler: async (
    ctx,
    args
  ): Promise<{ id: string; gameId: Id<'games'> | null; mayEdit: boolean } | null> => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) return null

    const rowId = ctx.db.normalizeId(LOCATE_TABLE[args.kind], args.id)
    let row: ContainedRow | null = rowId === null ? null : await ctx.db.get(rowId)
    row ??= await resolveLinkEnd(ctx, { type: args.kind, id: args.id }, null)
    if (row === null) {
      // A template pre-gen carries no app id, so it is found by its body id in
      // one of the caller's Games. Body ids repeat across Games seeded from the
      // same template; the first of the caller's Games to hold one answers.
      const memberships = await ctx.db
        .query('memberships')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .collect()
      for (const { gameId } of memberships) {
        const seeded = await rowsInGame(ctx, args.kind, gameId)
        row = seeded.find((r) => r.appId === undefined && linkIdOf(r) === args.id) ?? null
        if (row !== null) break
      }
    }
    if (row === null) return null

    const mine = (row.ownerId ?? null) === userId
    const membership = row.gameId === null ? null : await getMembership(ctx, row.gameId, userId)
    if (!mine && membership === null) return null
    // A Game's crawler has no owner: whoever runs the table writes it.
    const runsTable =
      args.kind === 'crawler' &&
      row.gameId !== null &&
      membership !== null &&
      (await isTableRunner(ctx, row.gameId, membership))
    return {
      id: linkIdOf(row) ?? args.id,
      // Only a Game the caller may list: `listForGame` refuses anyone else.
      gameId: membership === null ? null : row.gameId,
      mayEdit: mine || runsTable,
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
 * fill it from ([ADR-034](../../../docs/ARCHITECTURE.md#adr-034)
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
 * Every assignment the caller can see, plus every crawler in their Games — the
 * download half of the assignment model (ADR-037).
 *
 * ## Why links needed a way down
 *
 * Links mirrored up and never came back. `listMine` returned none, and
 * `listForGame` returned a Game's but nothing on the client read them, so a
 * pilot assigned to a crawler from one device — or by the server, or through
 * somebody else's mech — showed as unassigned everywhere else. The same gap hid
 * the crawler itself: a Game's crawler has no owner, so it is never in
 * `listMine`, and a pilot sheet had nothing to resolve its Home Crawler to
 * unless somebody happened to have pressed "Edit" on the crawler's row.
 *
 * ## What "can see" means here
 *
 *  - every link drawn **out of** an entity the caller owns, wherever it lives —
 *    which is every shelf link they have, since both ends of a shelf link are
 *    the same owner's (the container invariant);
 *  - every link **in** a Game the caller is a member of, whoever drew it;
 *  - every crawler in those Games.
 *
 * `gameIds` says which Games the answer covers, so the client knows which of
 * its cached links the server has spoken for. A cached link outside them is
 * not this query's to prune.
 *
 * Other members' pilots and mechs are deliberately not here: they are read
 * live, read-only, from `listForGame`, and caching somebody else's sheet in
 * this browser is how an editor appears whose every save is refused.
 */
export const listWiring = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx)

    const [pilots, mechs, memberships] = await Promise.all([
      ctx.db
        .query('pilots')
        .withIndex('by_owner_game', (q) => q.eq('ownerId', userId))
        .collect(),
      ctx.db
        .query('mechs')
        .withIndex('by_owner_game', (q) => q.eq('ownerId', userId))
        .collect(),
      ctx.db
        .query('memberships')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .collect(),
    ])

    const ownedIds = [...pilots, ...mechs]
      .map((row) => row.appId)
      .filter((id): id is string => id !== undefined)
    const gameIds = memberships.map((m) => m.gameId)

    const [outgoing, inGames, crawlers] = await Promise.all([
      Promise.all(
        ownedIds.map((id) =>
          ctx.db
            .query('softLinks')
            .withIndex('by_from', (q) => q.eq('from.id', id))
            .collect()
        )
      ),
      Promise.all(
        gameIds.map((gameId) =>
          ctx.db
            .query('softLinks')
            .withIndex('by_game', (q) => q.eq('gameId', gameId))
            .collect()
        )
      ),
      Promise.all(
        gameIds.map((gameId) =>
          ctx.db
            .query('crawlers')
            .withIndex('by_game', (q) => q.eq('gameId', gameId))
            .collect()
        )
      ),
    ])

    const links = new Map<string, Doc<'softLinks'>>()
    for (const link of [...outgoing.flat(), ...inGames.flat()]) links.set(link._id, link)

    return {
      gameIds,
      softLinks: [...links.values()].map((l) => ({
        _id: l._id,
        _creationTime: l._creationTime,
        gameId: l.gameId,
        from: l.from,
        to: l.to,
        type: l.type,
      })),
      crawlers: crawlers.flat().map((c) => ({
        appId: c.appId ?? null,
        gameId: c.gameId,
        updatedAt: c.updatedAt,
        body: c.body,
      })),
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
    await pruneLinksOfRow(ctx, doc)
    await releaseSeatsOf(ctx, args.table === 'pilots' ? 'pilot' : 'mech', doc, doc.gameId)
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

    const crawlerId = await ctx.db.insert('crawlers', {
      gameId: args.gameId,
      // Communal in a Game, owned on a shelf. Both-null is the invalid row, so
      // a shelf crawler MUST take an owner and the caller is the only candidate.
      ownerId: args.gameId === null ? userId : null,
      appId: args.appId,
      body,
      updatedAt: Date.now(),
    })
    // The first crawler raised in a Game becomes its primary and takes aboard
    // everyone already there (ADR-037).
    const raised = await ctx.db.get(crawlerId)
    if (raised !== null) await crawlerEnteredGame(ctx, raised)
    return crawlerId
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
    // The crew's links go with it, as a pilot's or mech's do in `remove`;
    // without this a scrapped crawler kept its crew wired to nothing.
    await pruneLinksOfRow(ctx, doc)
    if (doc.gameId !== null) await crawlerLeftGame(ctx, doc.gameId, doc._id)
  },
})

/**
 * Who may write a crawler's body — it depends on which container holds it.
 *
 * In a Game the crawler is the Mediator's (ADR-038 §5, plan D11): Salvage,
 * Craft, Trade, Upkeep, Upgrade, damage and Scrap a mech are all theirs, and a
 * player asks at the table. It was every member's (ADR-030 D8) until the
 * Dashboard made the Mediator the one who runs Downtime. While a Game has no
 * Mediator the Organizer holds it, as they hold raising and scrapping one
 * (`requireTableRunner`), so a crawler is never left with nobody to keep it.
 * On a shelf it is an ordinary owned entity and only its owner may touch it.
 *
 * Split out from the two call sites rather than inlined at each, because a
 * container-dependent rule written twice is a rule that will eventually be
 * written two different ways.
 */
async function assertMayEditCrawler(ctx: MutationCtx, doc: Doc<'crawlers'>): Promise<void> {
  if (doc.gameId !== null) {
    await requireTableRunner(ctx, doc.gameId)
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

    const kind = args.table === 'pilots' ? 'pilot' : 'mech'
    const existing = await byAppId(ctx, args.table, args.appId)
    if (existing === null) {
      await assertMayAddToContainer(ctx, args.gameId, userId)
      const id = await ctx.db.insert(args.table, {
        gameId: args.gameId,
        ownerId: userId,
        appId: args.appId,
        body,
        updatedAt: Date.now(),
      })
      // Created in a Game: aboard its primary crawler from the start (ADR-037).
      const created = await ctx.db.get(id)
      if (created !== null) await assignToPrimary(ctx, kind, created)
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
    const previousGameId = existing.gameId
    const moved = previousGameId !== args.gameId
    if (moved) {
      await assertMayAddToContainer(ctx, args.gameId, userId)
      await ctx.db.patch(existing._id, { gameId: args.gameId })
    }

    await ctx.db.patch(existing._id, { body, updatedAt: Date.now() })

    // A link may not straddle two containers (ADR-037), so a move takes with
    // it only the links whose other end is already where it is going, and
    // drops the rest in the same mutation.
    if (moved) {
      const row = await ctx.db.get(existing._id)
      if (row !== null) {
        await pruneLinksAcrossContainers(ctx, row, previousGameId)
        // Moved out of a Game: a pilot's seat there goes, and a mech leaves
        // whoever was aboard it on foot (ADR-038).
        await releaseSeatsOf(ctx, kind, row, previousGameId)
        // Moved into a Game: aboard its primary crawler (ADR-037).
        await assignToPrimary(ctx, kind, row)
      }
    }
  },
})

/**
 * Mirror a local crawler write, addressed by app id, as a **field-level merge**
 * (D19).
 *
 * The crawler needs its own mirror because it has no owner in a Game: its
 * writer is the table runner (`assertMayEditCrawler`), not whoever created
 * the row.
 *
 * Last-write-wins would still be wrong here: a full-body write from a client
 * holding a stale copy would silently undo whatever reached the server since
 * (an Upkeep paid from a second tab, a field the hub changed). Merging per
 * top-level field means two edits to different things both succeed, and only
 * a genuine same-field collision contends.
 *
 * Unlike the ownable tables this **never inserts**. A missing row means the
 * crawler is not in this Game — either it is a purely local build (Solo, or on
 * the shelf, neither of which has a server row to reach) or it was scrapped by
 * the table runner. Creating one here would route around the rule that raising
 * a crawler is the table runner's act, which is precisely the hole the ownable
 * upsert had to be closed against.
 *
 * **Clearing a field needs `unset`.** A patch cannot carry `undefined`: the
 * Convex client drops undefined object fields when it serialises the args, so
 * `{ maxSpOverride: undefined }` (the ↺ revert of a pinned Max SP) arrived as
 * `{}`, the merge kept the old value, and the pin came back on the next pull.
 * The client names each cleared key in `unset` instead; each must be a field of
 * the crawler schema, and the merged body still has to parse — so a required
 * field cannot be unset either.
 */
export const patchCrawlerByAppId = mutation({
  args: { appId: v.string(), patch: v.any(), unset: v.optional(v.array(v.string())) },
  handler: async (ctx, args): Promise<void> => {
    const existing = await crawlerByAppId(ctx, args.appId)
    if (existing === null) return

    await assertMayEditCrawler(ctx, existing)

    // A field patch never moves a crawler. Its container is the row's column
    // and the body's `gameId` together, and only `moveCrawler` writes them —
    // a body-only `gameId` here is how a "moved" crawler used to stay put on
    // the server while every client read it somewhere else. The same goes for
    // `unset`: clearing `gameId` would split the body from the column.
    const { gameId: _container, ...fields } = (args.patch ?? {}) as Record<string, unknown>
    const merged = unsetCrawlerFields(
      { ...(existing.body as Record<string, unknown>), ...fields },
      (args.unset ?? []).filter((key) => key !== 'gameId')
    )
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
    await pruneSoftLinksFor(ctx, args.appId)
    if (existing.gameId !== null) await crawlerLeftGame(ctx, existing.gameId, existing._id)
  },
})

/**
 * Move a crawler between a Game and its table runner's shelf (ADR-037).
 *
 * A crawler's container is three fields, and this is the one writer of all
 * three together — the row's `gameId` column, the body's `gameId`, and
 * `ownerId` (null in a Game, where it is communal; the mover on a shelf, where
 * an owner is required). The field-level mirror (`patchCrawlerByAppId`) used
 * to carry the move as a body patch and nothing else, so the column never
 * changed and nobody checked who was moving it.
 *
 * Only the table runner moves a crawler, in both directions:
 *
 *  - **in** — from their own shelf into a Game they run. It becomes the
 *    Game's, communal, and primary if the Game had none.
 *  - **out** — from a Game they run onto their own shelf, where it becomes
 *    theirs. If it was primary, the oldest crawler left takes over.
 *
 * Game to Game is refused: it is two acts (out, then in) for two tables.
 * Either way the links a move would leave straddling two containers go
 * (`pruneLinksAcrossContainers`). Players cannot move crawlers at all.
 */
export const moveCrawler = mutation({
  args: { appId: v.string(), gameId: v.union(v.id('games'), v.null()) },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx)
    const existing = await crawlerByAppId(ctx, args.appId)
    if (existing === null) return
    const from = existing.gameId
    const to = args.gameId
    if (from === to) return

    if (from !== null && to !== null) {
      throw new NotAuthorized(
        'Move the crawler to My Stuff first, then into the other game — a crawler changes tables one step at a time'
      )
    }
    if (from === null) {
      if (existing.ownerId !== userId) {
        throw new NotAuthorized("You cannot move another player's crawler")
      }
      await requireTableRunner(ctx, to as Id<'games'>)
    } else {
      await requireTableRunner(ctx, from)
    }

    const body = parseBody('crawlers', {
      ...(existing.body as Record<string, unknown>),
      gameId: to,
    })
    await ctx.db.patch(existing._id, {
      gameId: to,
      ownerId: to === null ? userId : null,
      body,
      updatedAt: Date.now(),
    })

    const row = await ctx.db.get(existing._id)
    if (row === null) return
    await pruneLinksAcrossContainers(ctx, row, from)
    if (from !== null) await crawlerLeftGame(ctx, from, row._id)
    if (to !== null) await crawlerEnteredGame(ctx, row)
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
 * The `from` end is always ownable — a mech in `mech-to-pilot` and
 * `mech-to-crawler`, a pilot in `pilot-to-crawler` — which is what lets one
 * lookup answer both questions the mirror has to ask: may this user draw the
 * link, and which container does it belong to.
 */
const SOFT_LINK_FROM_TABLE: Record<SoftLink['type'], OwnableTable> = {
  'mech-to-pilot': 'mechs',
  'pilot-to-crawler': 'pilots',
  'mech-to-crawler': 'mechs',
}

/**
 * Mirror a soft link to the server of record — an **assignment** (ADR-037).
 *
 * ## Why this exists
 *
 * Soft links were the one part of a roster that never left the browser.
 * `mirrorEntityWrite` returned early for them — they were called "derived", and
 * for a shelf they effectively are — while `listForGame` *read* them back. So a
 * Game showed whatever links existed when the account was claimed, and every
 * wiring change made afterwards was invisible to the rest of the table. A link
 * is not derived once a Game shares it; it is the assignment.
 *
 * ## Permission comes from the `from` end; the container from both
 *
 * You may draw a link out of an entity you may write, and it is filed in that
 * entity's container. Wiring your own mech to a crewmate's pilot is your
 * business because the mech is yours.
 *
 * The `to` end used to be a free-form string nobody looked up. It is resolved
 * now, because the assignment model has three invariants and two of them are
 * about it:
 *
 *  - **one container** — both ends in the same Game, or on the same owner's
 *    shelf. Anything else is refused with a player-facing `ConvexError`; the
 *    client store refuses the same pair first when it holds both ends.
 *  - **cardinality** — drawing the link REPLACES the links it conflicts with,
 *    in this same mutation (`writeSoftLink`). Replacing a link drawn out of
 *    somebody else's mech — the other mech flying this pilot — is allowed only
 *    to the owner of that mech or of the pilot: the pilot's owner decides who
 *    flies them, the mech's owner what it carries, and nobody else either.
 *
 * ## When an end has no server row
 *
 * A `from` end with no row is a purely local build — Solo, or a pre-account
 * roster the migration has not sent yet — so there is nothing to anchor to and
 * this no-ops. A `to` end with no row is treated the same way and for the same
 * reason: the claim that uploads that build uploads its wiring with it. A link
 * whose ends are both on the server is the only kind this writes, which is what
 * lets every row it writes satisfy all three invariants.
 */
export const upsertSoftLink = mutation({
  args: {
    from: v.object({ type: entityRefType, id: v.string() }),
    to: v.object({ type: entityRefType, id: v.string() }),
    type: softLinkType,
  },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx)
    if (!endsMatchType(args)) {
      // A client defect, not a refusal: the store resolves the type from the
      // ends and could never send this.
      throw new Error(`A ${args.type} link cannot join ${args.from.type} → ${args.to.type}`)
    }

    const anchor = await byAppId(ctx, SOFT_LINK_FROM_TABLE[args.type], args.from.id)
    if (anchor === null) return
    assertMayWrite(anchor, userId)

    const target = await resolveLinkEnd(ctx, args.to, anchor.gameId)
    if (target === null) return
    if (!sameContainerRows(anchor, target)) throw new ConvexError(CROSS_CONTAINER_REFUSAL)

    await writeSoftLink(ctx, args, anchor.gameId, {
      mayReplace: async (conflict) => {
        // Conflicts on the `from` end are this anchor's own links — the caller
        // may write it, so they may replace them.
        if (conflict.from.id === args.from.id) return
        if (target.ownerId === userId) return
        const otherMech = await resolveLinkEnd(ctx, conflict.from, anchor.gameId)
        if (otherMech === null || otherMech.ownerId === userId) return
        throw new NotAuthorized(
          'That pilot already flies another mech — whoever holds that mech or that pilot has to unassign it first'
        )
      },
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
    await releaseSeatsOf(ctx, args.table === 'pilots' ? 'pilot' : 'mech', existing, existing.gameId)
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
