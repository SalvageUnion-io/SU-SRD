import { getAuthUserId } from '@convex-dev/auth/server'
import type { ObjectType } from 'convex/values'
import { ConvexError, v } from 'convex/values'
import { staleWriteError } from '../src/lib/connection/staleWrite'
import { CROSS_CONTAINER_REFUSAL, endsMatchType, isSlotted } from '../src/lib/links/linkRules'
import type { SoftLink } from '../src/lib/schemas/softLink'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { query } from './_generated/server'
import type { ContainedRow, OwnedTable } from './model/entities'
import {
  assignToPrimary,
  countPatternBuild,
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
import { crewSlot, entityRefType, softLinkType } from './schema'

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
 * built (ADR-030 §6: decided, not built).
 *
 * Writing is per-*entity*: only the owner writes their own pilot, and nobody
 * writes a crewmate's. A Mediator wanting to change someone else's sheet goes
 * through a proposal (ADR-030 §4), not through here — there is deliberately no
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
 * into any Game they belong to**, crawler or no crawler (ADR-037): the crew can
 * gather first, and the first crawler to arrive becomes the **primary** and picks up everybody without one. Whoever
 * enters a Game that already has a primary is assigned to it on the way in, by
 * an explicit link the server writes as part of the add or the move.
 *
 * Moving a crawler is the table runner's act in both directions
 * (`moveCrawler`): from their own shelf into the Game, or out of it onto their
 * own shelf, where it becomes theirs.
 *
 * ## What lives elsewhere
 *
 * This module is the ownable-entity API: the reads, and the server-first
 * writes the store awaits on every edit (`commitEntityWrite`). Two neighbours
 * live in modules that say what they are:
 *
 *  - `shelf.ts` — the shelf-only collections, saved patterns and the NPC tray.
 *  - `changeLog.ts` — the client's Change Log append.
 */

const OWNABLE = v.union(v.literal('pilots'), v.literal('mechs'))

/** The tables written whole by their owner: pilots, mechs and built NPCs (ADR-043). */
const OWNED = v.union(v.literal('pilots'), v.literal('mechs'), v.literal('npcs'))

/** A pilot, mech or NPC body write, addressed by app id (`upsertByAppId`). */
const OWNABLE_WRITE = {
  table: OWNED,
  appId: v.string(),
  gameId: v.union(v.id('games'), v.null()),
  body: v.any(),
  /** The row version the client's copy came from; `null` when it holds none. */
  expectedUpdatedAt: v.union(v.number(), v.null()),
}

/** A crawler field patch, addressed by app id (`patchCrawlerByAppId`). */
const CRAWLER_PATCH = {
  appId: v.string(),
  patch: v.any(),
  unset: v.optional(v.array(v.string())),
}

/** A soft link, addressed by its endpoints (and, for crew, its slot). */
const LINK = {
  from: v.object({ type: entityRefType, id: v.string() }),
  to: v.object({ type: entityRefType, id: v.string() }),
  type: softLinkType,
  slot: v.optional(crewSlot),
}

/**
 * Who may write an entity.
 *
 * Synchronous and ctx-free on purpose: the answer depends only on the row's
 * own `ownerId`. There is deliberately no lookup that could grant a Mediator a
 * privileged write here — changing someone else's sheet goes through a
 * proposal (ADR-030 §4), and giving this function a ctx would invite exactly that.
 */
export function assertMayWrite(
  doc: Doc<'pilots'> | Doc<'mechs'> | Doc<'npcs'>,
  userId: Id<'users'>
): void {
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

/**
 * Everything in a Game the caller can see: all pilots, mechs and built NPCs,
 * plus the crawler. NPCs ride here because a bay crewed by another member's
 * NPC is read from this listing, never cached (ADR-043).
 */
export const listForGame = query({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.gameId)

    const [pilots, mechs, crawlers, npcs, softLinks, primary] = await Promise.all([
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
        .query('npcs')
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
      npcs: npcs.map((n) => ({
        _id: n._id,
        appId: n.appId ?? null,
        ownerId: n.ownerId,
        body: n.body,
      })),
      // The same link shape `listWiring` serves, so the read-only sheet store
      // turns these into local `SoftLink`s through the one adapter
      // (`softLinkFromServer`) the sync already uses.
      softLinks: softLinks.map(servedLink),
      /** The crawler new crew is assigned to (ADR-037), or null before one exists. */
      primaryCrawlerId: primary?._id ?? null,
    }
  },
})

/** A link row as the client syncs it — `softLinkFromServer`'s input. */
function servedLink(l: Doc<'softLinks'>) {
  return {
    _id: l._id,
    _creationTime: l._creationTime,
    gameId: l.gameId,
    from: l.from,
    to: l.to,
    type: l.type,
    ...(l.slot === undefined ? {} : { slot: l.slot }),
  }
}

const LOCATE_TABLE = { pilot: 'pilots', mech: 'mechs', crawler: 'crawlers', npc: 'npcs' } as const

/**
 * Where one sheet lives and whether the caller may edit it — the question the
 * live sheet route (`/sheet/$kind/$id`) asks of anything this browser does not
 * hold, and of anything it does, to learn which Game to read alongside it.
 *
 * `id` is what the client addresses an entity by: its app id, or — for a
 * template-seeded pre-gen, which has none — the id in its body. A Convex row
 * id is accepted too, because the Discord bot addresses every sheet by it, and
 * links already posted to the retired crew-view URL redirect here carrying one;
 * `id` in the answer is always the client's, so the route can put the
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

    const mine = row.ownerId === userId
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
 * ## Why it exists
 *
 * It is the way down outside a Game (`listForGame` is scoped to one): without
 * it a signed-in player opening ITUN on a second device would see an **empty
 * roster**. A cache is something that can be *filled*, and this is what fills
 * it ([ADR-034](../../../docs/ARCHITECTURE.md#adr-034) decision 2).
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

    const [pilots, mechs, crawlers, builtNpcs, patterns, npcs] = await Promise.all([
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
        .query('npcs')
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

    // Bodies, not documents. The caller is filling a local store whose records
    // are keyed by the app-level id inside the body, so a Convex `_id` would be
    // noise — and `appId` rides along separately for the rows that carry one,
    // because that is what the client's server-first write addresses by.
    //
    // `updatedAt` is the row's version. `ShelfSync` adopts a row only when it
    // is newer than the one it last saw, and a pilot or mech write sends it
    // back as the version the edit was made against (`upsertByAppId`). Keyed on
    // ids alone, a body edited on another device never came down, and the next
    // whole-body write from here reverted it. Patterns and the tray have no such
    // column; `ShelfSync` reads their body's own stamp instead.
    const versioned = (r: ContainedRow) => ({
      appId: r.appId ?? null,
      updatedAt: r.updatedAt,
      body: r.body,
    })
    return {
      pilots: pilots.map(versioned),
      mechs: mechs.map(versioned),
      crawlers: crawlers.map(versioned),
      // Built NPCs (ADR-043), owned and versioned exactly as pilots are. Not
      // `encounterNpcs` below, which is the Mediator's tray.
      npcs: builtNpcs.map(versioned),
      mechPatterns: patterns.map((r) => ({ body: r.body })),
      // Without this the shelf tray was WRITE-ONLY. `games.destroy` writes
      // `encounterNpcs`, and no query read them back: `mediator.npcs`
      // requires a `gameId`, so a tray on a shelf was reachable by nothing.
      // It went up and never came down.
      encounterNpcs: npcs.map((r) => ({ body: r.body })),
    }
  },
})

/**
 * Every assignment the caller can see, plus every crawler in their Games — the
 * download half of the assignment model (ADR-037).
 *
 * ## Why links need a way down
 *
 * `listMine` returns no links, so without this a pilot assigned to a crawler
 * from one device — or by the server, or through somebody else's mech — would
 * show as unassigned everywhere else. The crawler needs it too: a Game's
 * crawler has no owner, so it is never in `listMine`, and a pilot sheet would
 * have nothing to resolve its Home Crawler to.
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

    const [pilots, mechs, npcs, memberships] = await Promise.all([
      ctx.db
        .query('pilots')
        .withIndex('by_owner_game', (q) => q.eq('ownerId', userId))
        .collect(),
      ctx.db
        .query('mechs')
        .withIndex('by_owner_game', (q) => q.eq('ownerId', userId))
        .collect(),
      ctx.db
        .query('npcs')
        .withIndex('by_owner_game', (q) => q.eq('ownerId', userId))
        .collect(),
      ctx.db
        .query('memberships')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .collect(),
    ])

    const ownedIds = [...pilots, ...mechs, ...npcs]
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
      softLinks: [...links.values()].map(servedLink),
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
 * The twin of `removeByAppId`, which `commitEntityWrite` uses, and necessary
 * because the Game roster cannot use that one: it is looking at rows this browser may never
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
 * carries `ownerId: null`, which is exactly what communal means (ADR-030 §5). It has
 * no owner from the moment it exists and is never handed to anyone; its fields
 * are the table runner's to fill, as raising and scrapping it are (ADR-038 §5).
 *
 * ## `gameId: null` raises one on your own shelf
 *
 * A crawler can also live on a shelf (`schema.ts`), and that is the only case
 * where it has an owner. There is no table to run, so there is no table runner
 * to require and no crew to be communal with — the caller is simply the owner.
 */
export const createCrawler = mutation({
  args: {
    /** The Game this crawler is raised in, or `null` to raise it on your shelf. */
    gameId: v.union(v.id('games'), v.null()),
    /** The app-level UUID this row carries — see `pilots.appId`. */
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
 * In a Game, scrapping is the table runner's act exactly as editing is
 * (ADR-038 §5): the crawler is the Mediator's, and the crew's home that every
 * pilot is anchored to, so whoever runs the table decides it is gone.
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
 * In a Game the crawler is the Mediator's (ADR-038 §5): Salvage,
 * Craft, Trade, Upkeep, Upgrade, damage and Scrap a mech are all theirs, and a
 * player asks at the table. While a Game has no Mediator the Organizer holds
 * it, as they hold raising and scrapping one (`requireTableRunner`), so a
 * crawler is never left with nobody to keep it.
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
 * Who may scrap a crawler — the same people who may edit one
 * (`assertMayEditCrawler`), kept separate only for its refusal message.
 *
 * In a Game it is the **table runner's** act, as every write to the crawler is
 * (ADR-038 §5); no other member edits or scraps it. On a shelf the owner
 * decides, exactly as they do for their own pilots and mechs.
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
 * production several did (a since-deleted bulk upload inserted blindly, so
 * running it from a second browser duplicated the roster).
 *
 * `.unique()` would turn that *data* condition into a thrown `Server Error` on
 * every write to the entity, locking the player out of their own build over a
 * row they cannot see. A duplicate is a repair job, not a reason to refuse
 * the write, so this resolves one row, warns, and lets the write land.
 *
 * **The oldest row wins, deterministically.** It is the row every earlier
 * write already landed on, so choosing it keeps editing the copy the client has
 * been addressing all along rather than silently migrating to a younger one.
 * `_creationTime` is used rather than index order because index order is not a
 * documented guarantee, and a winner that moves between calls would be worse
 * than the throw it replaces.
 */
async function byAppId(
  ctx: MutationCtx,
  table: OwnedTable,
  appId: string
): Promise<Doc<'pilots'> | Doc<'mechs'> | Doc<'npcs'> | null> {
  const matches = (await ctx.db
    .query(table)
    .withIndex('by_app_id', (q) => q.eq('appId', appId))
    .collect()) as Array<Doc<'pilots'> | Doc<'mechs'> | Doc<'npcs'>>

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
 * Write an entity to the server of record, addressed by app id — the target of
 * the store's awaited `commitEntityWrite`.
 *
 * Upsert rather than update: an entity's first write is its create, addressed
 * by the app id the client minted, so a missing row means "create it".
 *
 * The insert branch is a **create into a container**, so it answers to
 * `assertMayAddToContainer`. Leaving it open would have made the whole rule
 * cosmetic: this is the client's ordinary write path, so a player blocked from
 * adding to a Game could otherwise place a pilot there by writing it.
 *
 * ## A write from a stale copy is refused
 *
 * The body is replaced whole, so a write made against an older copy would undo
 * whatever reached the row since — another device's edit, silently, with
 * nobody told. `expectedUpdatedAt` is the row version the client's copy came
 * from (`listMine`, or this mutation's own answer to its last write); when the
 * row has moved past it, the write is refused with the row the server holds
 * (`staleWriteError`), so the client can show it and the player can make the
 * change again on top. Every client sends it; `null` says it holds no version
 * of the row — a create, or a row this tab has not synced yet — and is not
 * checked.
 *
 * Returns the row's new version, which is what the client sends next time.
 */
export const upsertByAppId = mutation({
  args: OWNABLE_WRITE,
  handler: async (ctx, args): Promise<{ updatedAt: number }> =>
    writeOwnable(ctx, await requireUser(ctx), args),
})

/** `upsertByAppId`'s write, shared with `transfer`. */
async function writeOwnable(
  ctx: MutationCtx,
  userId: Id<'users'>,
  args: ObjectType<typeof OWNABLE_WRITE>
): Promise<{ updatedAt: number }> {
  const body = parseBody(args.table, args.body)

  // A built NPC is owned like a pilot but plays no part in the primary
  // crawler's crew or a seat: it boards nothing and is never auto-assigned.
  const kind = args.table === 'pilots' ? 'pilot' : args.table === 'mechs' ? 'mech' : null
  const existing = await byAppId(ctx, args.table, args.appId)
  const updatedAt = Date.now()
  if (existing === null) {
    await assertMayAddToContainer(ctx, args.gameId, userId)
    const id = await ctx.db.insert(args.table, {
      gameId: args.gameId,
      ownerId: userId,
      appId: args.appId,
      body,
      updatedAt,
    })
    // Created in a Game: aboard its primary crawler from the start (ADR-037).
    const created = await ctx.db.get(id)
    if (created !== null && kind !== null) {
      await assignToPrimary(ctx, kind, created as Doc<'pilots'> | Doc<'mechs'>)
    }
    // Built from a saved pattern: the pattern page counts it (#1276). Only on
    // the create — editing a mech built from one never counts it again.
    if (args.table === 'mechs') await countPatternBuild(ctx, body, userId)
    return { updatedAt }
  }

  assertMayWrite(existing, userId)
  // After the ownership check, so the refusal hands the row only to its owner.
  if (args.expectedUpdatedAt !== null && existing.updatedAt > args.expectedUpdatedAt) {
    throw staleWriteError(existing)
  }

  /**
   * The write also re-homes the row when the client has moved it.
   *
   * The move is a create *into* the target container as far as the rules are
   * concerned, so it answers to the same gate; leaving the source is
   * unconditional.
   */
  const previousGameId = existing.gameId
  const moved = previousGameId !== args.gameId
  if (moved) {
    await assertMayAddToContainer(ctx, args.gameId, userId)
    await ctx.db.patch(existing._id, { gameId: args.gameId })
  }

  await ctx.db.patch(existing._id, { body, updatedAt })

  // A link may not straddle two containers (ADR-037), so a move takes with
  // it only the links whose other end is already where it is going, and
  // drops the rest in the same mutation.
  if (moved) {
    const row = await ctx.db.get(existing._id)
    if (row !== null) {
      await pruneLinksAcrossContainers(ctx, row, previousGameId)
      if (kind !== null) {
        const crew = row as Doc<'pilots'> | Doc<'mechs'>
        // Moved out of a Game: a pilot's seat there goes, and a mech leaves
        // whoever was aboard it on foot (ADR-038).
        await releaseSeatsOf(ctx, kind, crew, previousGameId)
        // Moved into a Game: aboard its primary crawler (ADR-037).
        await assignToPrimary(ctx, kind, crew)
      }
    }
  }
  return { updatedAt }
}

/**
 * Write a crawler, addressed by app id, as a **field-level merge**
 * (ADR-030 §5).
 *
 * The crawler needs its own write because it has no owner in a Game: its
 * writer is the table runner (`assertMayEditCrawler`), not whoever created
 * the row.
 *
 * Last-write-wins would still be wrong here: a full-body write from a client
 * holding a stale copy would silently undo whatever reached the server since
 * (an Upkeep paid from a second tab, a field the hub changed). Merging per
 * top-level field means two edits to different things both succeed, and only
 * a genuine same-field collision contends.
 *
 * Unlike the ownable tables this **never inserts** (`createCrawler` raises
 * one). A missing row means the crawler was scrapped. Creating one here would route around the rule that raising
 * a crawler is the table runner's act, which is precisely the hole the ownable
 * upsert had to be closed against.
 *
 * **Clearing a field needs `unset`.** A patch cannot carry `undefined`: the
 * Convex client drops undefined object fields when it serialises the args, so
 * `{ maxSpOverride: undefined }` (the ↺ revert of a pinned Max SP) would arrive
 * as `{}` and the merge would keep the pinned value.
 * The client names each cleared key in `unset` instead; each must be a field of
 * the crawler schema, and the merged body still has to parse — so a required
 * field cannot be unset either.
 */
export const patchCrawlerByAppId = mutation({
  args: CRAWLER_PATCH,
  handler: async (ctx, args): Promise<void> => patchCrawler(ctx, args),
})

/** `patchCrawlerByAppId`'s write, shared with `transfer`. */
async function patchCrawler(
  ctx: MutationCtx,
  args: ObjectType<typeof CRAWLER_PATCH>
): Promise<void> {
  const existing = await crawlerByAppId(ctx, args.appId)
  if (existing === null) return

  await assertMayEditCrawler(ctx, existing)

  // A field patch never moves a crawler. Its container is the row's column
  // and the body's `gameId` together, and only `moveCrawler` writes them — a
  // body-only `gameId` here would leave a "moved" crawler put on the server
  // while every client read it somewhere else. The same goes for `unset`: clearing `gameId` would split the body from the column.
  const { gameId: _container, ...fields } = (args.patch ?? {}) as Record<string, unknown>
  const merged = unsetCrawlerFields(
    { ...(existing.body as Record<string, unknown>), ...fields },
    (args.unset ?? []).filter((key) => key !== 'gameId')
  )
  const body = parseBody('crawlers', merged)

  await ctx.db.patch(existing._id, { body, updatedAt: Date.now() })
}

/** Scrap a crawler addressed by app id. Table runner only, like `removeCrawler`. */
export const removeCrawlerByAppId = mutation({
  args: { appId: v.string() },
  handler: async (ctx, args): Promise<void> => removeCrawlerRow(ctx, args.appId),
})

/** `removeCrawlerByAppId`'s delete, shared with `transfer`. */
async function removeCrawlerRow(ctx: MutationCtx, appId: string): Promise<void> {
  const existing = await crawlerByAppId(ctx, appId)
  if (existing === null) return

  await assertMayScrapCrawler(ctx, existing)
  await ctx.db.delete(existing._id)
  await pruneLinksOfRow(ctx, existing)
  if (existing.gameId !== null) await crawlerLeftGame(ctx, existing.gameId, existing._id)
}

/**
 * Move a crawler between a Game and its table runner's shelf (ADR-037).
 *
 * A crawler's container is three fields, and this is the one writer of all
 * three together — the row's `gameId` column, the body's `gameId`, and
 * `ownerId` (null in a Game, where it is communal; the mover on a shelf, where
 * an owner is required). The field-level write (`patchCrawlerByAppId`) never
 * moves one.
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
  handler: async (ctx, args): Promise<void> =>
    moveCrawlerRow(ctx, await requireUser(ctx), args.appId, args.gameId),
})

/** `moveCrawler`'s write, shared with `transfer`. */
async function moveCrawlerRow(
  ctx: MutationCtx,
  userId: Id<'users'>,
  appId: string,
  to: Id<'games'> | null
): Promise<void> {
  const existing = await crawlerByAppId(ctx, appId)
  if (existing === null) return
  const from = existing.gameId
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
}

/**
 * Look a crawler up by the app-level UUID the client holds.
 *
 * Tolerant of duplicates for exactly the reasons `byAppId` is: `by_app_id` is
 * not a uniqueness constraint, and `.unique()` would turn a duplicate into a
 * thrown error on every write, locking the player out of their own crawler
 * over a row they cannot see. So this resolves the oldest row, warns, and lets
 * the write land. The crawler has no duplicates in production today, and that
 * is luck rather than a constraint: nothing in the index stops a second row.
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
 * lookup answer both questions a link write has to ask: may this user draw the
 * link, and which container does it belong to.
 */
const SOFT_LINK_FROM_TABLE: Record<SoftLink['type'], OwnedTable> = {
  'mech-to-pilot': 'mechs',
  'pilot-to-crawler': 'pilots',
  'mech-to-crawler': 'mechs',
  'npc-to-crawler': 'npcs',
}

/**
 * A crew slot names the slot it fills, and only a crew link has one. The client
 * builds both from `CrewSlotSchema`'s refinement, so a mismatch is a defect,
 * not a player's mistake.
 */
function assertSlotMatchesType(args: ObjectType<typeof LINK>): void {
  const slotted = isSlotted(args.type)
  if (slotted && args.slot === undefined) {
    throw new Error('An npc-to-crawler link names the crew slot it fills')
  }
  if (!slotted && args.slot !== undefined) {
    throw new Error(`A ${args.type} link has no crew slot`)
  }
}

/** The copy a player sees when they may not assign or unassign this crawler's crew. */
const CREW_REFUSAL =
  'Only whoever runs the table assigns crawler crew — design an NPC on your shelf and move it into this Game to offer it.'

/**
 * Who may draw or delete an `npc-to-crawler` link: whoever may write the
 * crawler (ADR-043) — its owner on a shelf, the table runner in a Game. The one
 * link authorised by its `to` end, because in a Game the NPC is often a
 * player's while the crawler is the Mediator's.
 */
async function assertMayCrew(ctx: MutationCtx, crawler: Doc<'crawlers'>): Promise<void> {
  const userId = await requireUser(ctx)
  if (crawler.gameId === null) {
    if (crawler.ownerId !== userId) throw new NotAuthorized(CREW_REFUSAL)
    return
  }
  const membership = await getMembership(ctx, crawler.gameId, userId)
  if (membership === null || !(await isTableRunner(ctx, crawler.gameId, membership))) {
    throw new NotAuthorized(CREW_REFUSAL)
  }
}

/** Whether a crawler body has the slot: the bay installed, or a type chosen. */
function crawlerHasSlot(body: unknown, slot: NonNullable<ObjectType<typeof LINK>['slot']>) {
  const crawler = (body ?? {}) as { type?: unknown; crawlerBays?: unknown }
  if (slot.kind === 'type') return typeof crawler.type === 'string' && crawler.type.length > 0
  return (
    Array.isArray(crawler.crawlerBays) &&
    crawler.crawlerBays.some((bay) => (bay as { bayRef?: unknown })?.bayRef === slot.bayRef)
  )
}

/**
 * Draw an `npc-to-crawler` link (ADR-043). The NPC and the crawler share a
 * container, the caller may write the crawler, and the crawler has the slot.
 * Drawing it replaces the NPC's old slot and whoever filled this one, in this
 * same mutation (`writeSoftLink`). Neither end's body is written: the
 * crawler's inline crew stays exactly as it was, so unlinking restores it.
 */
async function drawCrewLink(ctx: MutationCtx, args: ObjectType<typeof LINK>): Promise<void> {
  const npc = await byAppId(ctx, 'npcs', args.from.id)
  if (npc === null) return
  const target = await resolveLinkEnd(ctx, args.to, npc.gameId)
  if (target === null) return
  const crawler = target as Doc<'crawlers'>
  await assertMayCrew(ctx, crawler)
  if (!sameContainerRows(npc, crawler)) throw new ConvexError(CROSS_CONTAINER_REFUSAL)
  if (args.slot === undefined || !crawlerHasSlot(crawler.body, args.slot)) {
    throw new ConvexError('That crawler has no such crew slot.')
  }
  await writeSoftLink(ctx, args, crawler.gameId)
}

/**
 * Delete an `npc-to-crawler` link: the crawler's writer only, as drawing it is.
 * When the crawler is gone the link is a stale pointer, and the NPC's owner
 * may clear it.
 */
async function unwireCrewLink(
  ctx: MutationCtx,
  userId: Id<'users'>,
  args: ObjectType<typeof LINK>
): Promise<void> {
  const existing = await findSoftLink(ctx, args.from.id, args.to.id, args.type)
  if (existing === null) return
  const crawler = await resolveLinkEnd(ctx, args.to, existing.gameId)
  if (crawler === null) {
    const npc = await byAppId(ctx, 'npcs', args.from.id)
    if (npc !== null) assertMayWrite(npc, userId)
  } else {
    await assertMayCrew(ctx, crawler as Doc<'crawlers'>)
  }
  await ctx.db.delete(existing._id)
}

/**
 * Write a soft link to the server of record — an **assignment** (ADR-037). A
 * link is not derived once a Game shares it; it is the assignment, so every
 * wiring change reaches the rest of the table.
 *
 * ## Permission comes from the `from` end; the container from both
 *
 * You may draw a link out of an entity you may write, and it is filed in that
 * entity's container. Wiring your own mech to a crewmate's pilot is your
 * business because the mech is yours.
 *
 * The `to` end is resolved, because the assignment model has three invariants
 * and two of them are about it:
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
 * A `from` end with no row is not on the server, so there is nothing to anchor
 * to and this no-ops. A `to` end with no row is treated the same way and for
 * the same reason. A link
 * whose ends are both on the server is the only kind this writes, which is what
 * lets every row it writes satisfy all three invariants.
 */
export const upsertSoftLink = mutation({
  args: LINK,
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx)
    if (!endsMatchType(args)) {
      // A client defect, not a refusal: the store resolves the type from the
      // ends and could never send this.
      throw new Error(`A ${args.type} link cannot join ${args.from.type} → ${args.to.type}`)
    }
    assertSlotMatchesType(args)
    // Crew is authorised by the crawler, not by the NPC (ADR-043).
    if (isSlotted(args.type)) {
      await drawCrewLink(ctx, args)
      return
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
  args: LINK,
  handler: async (ctx, args): Promise<void> => unwireSoftLink(ctx, await requireUser(ctx), args),
})

/** `removeSoftLink`'s delete, shared with `transfer`. */
async function unwireSoftLink(
  ctx: MutationCtx,
  userId: Id<'users'>,
  args: ObjectType<typeof LINK>
): Promise<void> {
  if (isSlotted(args.type)) {
    await unwireCrewLink(ctx, userId, args)
    return
  }
  const anchor = await byAppId(ctx, SOFT_LINK_FROM_TABLE[args.type], args.from.id)
  if (anchor === null) return
  assertMayWrite(anchor, userId)

  const existing = await findSoftLink(ctx, args.from.id, args.to.id, args.type)
  if (existing === null) return

  await ctx.db.delete(existing._id)
}

/** Delete by app id. A row that is already gone is not an error. */
export const removeByAppId = mutation({
  args: { table: OWNED, appId: v.string() },
  handler: async (ctx, args): Promise<void> =>
    removeOwnable(ctx, await requireUser(ctx), args.table, args.appId),
})

/**
 * `removeByAppId`'s delete, shared with `transfer`. The row's links go with it
 * (`pruneLinksOfRow`), as they do on every remove path.
 */
async function removeOwnable(
  ctx: MutationCtx,
  userId: Id<'users'>,
  table: OwnedTable,
  appId: string
): Promise<void> {
  const existing = await byAppId(ctx, table, appId)
  if (existing === null) return

  assertMayWrite(existing, userId)
  await ctx.db.delete(existing._id)
  // An NPC's crew link goes too, so the slot falls back to the book's line.
  await pruneLinksOfRow(ctx, existing)
  if (table === 'npcs') return
  await releaseSeatsOf(
    ctx,
    table === 'pilots' ? 'pilot' : 'mech',
    existing as Doc<'pilots'> | Doc<'mechs'>,
    existing.gameId
  )
}

/**
 * Move value between entities — cargo stow/load, a scrap hand-off — in ONE
 * mutation, so it lands whole or not at all (`entityStore.transfer`).
 *
 * Every record answers to the rule its own mutation enforces: only an owner
 * writes their pilot or mech, a body from a stale copy is refused, only the
 * table runner writes or scraps a Game's crawler. A Convex mutation is a
 * transaction, so a refusal anywhere rolls back every write before it — a stow
 * cannot land on the mech and be refused on the crawler.
 *
 * Returns the new version of each pilot and mech it wrote, as `upsertByAppId`
 * does for one.
 */
export const transfer = mutation({
  args: {
    updates: v.array(
      v.union(
        v.object(OWNABLE_WRITE),
        v.object({
          table: v.literal('crawlers'),
          ...CRAWLER_PATCH,
          /** Present when the patch moves the crawler (`moveCrawler`). */
          gameId: v.optional(v.union(v.id('games'), v.null())),
        })
      )
    ),
    deletes: v.array(
      v.union(
        v.object({ table: OWNED, appId: v.string() }),
        v.object({ table: v.literal('crawlers'), appId: v.string() }),
        v.object({ table: v.literal('softLinks'), ...LINK })
      )
    ),
  },
  handler: async (ctx, args): Promise<{ versions: { appId: string; updatedAt: number }[] }> => {
    const userId = await requireUser(ctx)
    const versions: { appId: string; updatedAt: number }[] = []
    for (const update of args.updates) {
      if (update.table === 'crawlers') {
        const { table: _table, gameId, ...patch } = update
        if (gameId !== undefined) await moveCrawlerRow(ctx, userId, update.appId, gameId)
        await patchCrawler(ctx, patch)
        continue
      }
      const { updatedAt } = await writeOwnable(ctx, userId, update)
      versions.push({ appId: update.appId, updatedAt })
    }
    for (const removal of args.deletes) {
      if (removal.table === 'softLinks') {
        const { table: _table, ...link } = removal
        await unwireSoftLink(ctx, userId, link)
      } else if (removal.table === 'crawlers') {
        await removeCrawlerRow(ctx, removal.appId)
      } else {
        await removeOwnable(ctx, userId, removal.table, removal.appId)
      }
    }
    return { versions }
  },
})
