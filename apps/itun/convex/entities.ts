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
  requireTableRunner,
  requireUser,
} from './model/permissions'

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
 * Raise a Union Crawler in this Game. Table runner only.
 *
 * A Game may hold **several** crawlers, and that is not a leniency — a long
 * campaign genuinely runs more than one: a crawler is lost or scrapped and the
 * crew rebuilds, or a second one is met, escorted and eventually joined. The
 * schema never said one, and forcing it here would make the ordinary course of
 * a campaign look like a bug.
 *
 * There is deliberately no `unassigned` axis: a crawler has no `ownerId` at all
 * (D8). It belongs to the crew from the moment it exists, which is exactly why
 * players may fill in its fields without ever being handed it.
 */
export const createCrawler = mutation({
  args: {
    gameId: v.id('games'),
    /** The local UUID this row mirrors — see `pilots.appId`. */
    appId: v.optional(v.string()),
    body: v.any(),
  },
  handler: async (ctx, args): Promise<Id<'crawlers'>> => {
    await requireTableRunner(ctx, args.gameId)

    const result = CrawlerSchema.safeParse(args.body)
    if (!result.success) {
      throw new Error(`Invalid crawler payload: ${result.error.issues[0]?.message ?? 'unknown'}`)
    }

    return await ctx.db.insert('crawlers', {
      gameId: args.gameId,
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
    await requireTableRunner(ctx, doc.gameId)
    await ctx.db.delete(args.crawlerId)
  },
})

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
     * A crawler has no owner column (it is communal, D8) and no Game yet, so a
     * claimed one is parked on a **placeholder Game of one** rather than
     * discarded: the shelf cannot hold it, and inventing a crawler-shaped shelf
     * would be a third container the model does not have.
     */
    /*
     * The crawler pass resolves what it will write BEFORE it raises the
     * placeholder Game, because that Game is itself a write that must not
     * repeat. Raising it up front — as this did — meant a re-claim with nothing
     * new to say still left behind an empty "Claimed crawler" Game and a
     * membership in it, so a player's game list grew by one every time they
     * signed in somewhere new.
     */
    const crawlers = args.crawlers ?? []
    const claimableCrawlers: Array<{ appId: string | undefined; body: unknown }> = []
    for (const body of crawlers) {
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
      claimableCrawlers.push({ appId, body: parsed.data })
    }

    let shelfGameId: Id<'games'> | null = null
    if (claimableCrawlers.length > 0) {
      shelfGameId = await ctx.db.insert('games', { name: 'Claimed crawler' })
      await ctx.db.insert('memberships', {
        gameId: shelfGameId,
        userId,
        mediator: false,
        organizer: true,
        joinedAt: now,
      })
    }
    for (const crawler of claimableCrawlers) {
      if (shelfGameId === null) {
        skipped += 1
        continue
      }
      await ctx.db.insert('crawlers', {
        gameId: shelfGameId,
        appId: crawler.appId,
        body: crawler.body,
        updatedAt: now,
      })
      bump('crawlers')
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
       * entity (nothing calls `.unique()` on this table) but they are not
       * harmless: `listForGame` returns every row, so a roster would draw the
       * same mech-to-pilot link twice.
       */
      // Bound into locals: the checks above narrowed `l.from`/`l.to`, but that
      // narrowing does not survive the `await` and the closure below.
      const from = { type: l.from.type, id: l.from.id }
      const to = { type: l.to.type, id: l.to.id }
      const linkType = l.type

      const duplicateLink = (
        await ctx.db
          .query('softLinks')
          .withIndex('by_from', (q) => q.eq('from.id', from.id))
          .collect()
      ).some((row) => row.to.id === to.id && row.type === linkType)
      if (duplicateLink) {
        alreadyPresent += 1
        continue
      }

      await ctx.db.insert('softLinks', { gameId: shelfGameId, from, to, type: linkType })
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
        sharedToGame: false,
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
 */
async function byAppId(
  ctx: MutationCtx,
  table: OwnableTable,
  appId: string
): Promise<Doc<'pilots'> | Doc<'mechs'> | null> {
  return (await ctx.db
    .query(table)
    .withIndex('by_app_id', (q) => q.eq('appId', appId))
    .unique()) as Doc<'pilots'> | Doc<'mechs'> | null
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
    const existing = await ctx.db
      .query('crawlers')
      .withIndex('by_app_id', (q) => q.eq('appId', args.appId))
      .unique()
    if (existing === null) return

    await requireMember(ctx, existing.gameId)

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
    const existing = await ctx.db
      .query('crawlers')
      .withIndex('by_app_id', (q) => q.eq('appId', args.appId))
      .unique()
    if (existing === null) return

    await requireTableRunner(ctx, existing.gameId)
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
  },
})
