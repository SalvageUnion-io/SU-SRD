import { v } from 'convex/values'

import { CrawlerSchema } from '../src/lib/schemas/crawler'
import { MechSchema } from '../src/lib/schemas/mech'
import { PilotSchema } from '../src/lib/schemas/pilot'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { NotAuthorized, getMembership, requireMember, requireUser } from './model/permissions'

/**
 * Entity reads and writes against the server of record (ADR-030 §1).
 *
 * ## Every write Zod-parses before it persists
 *
 * The schema stores entity bodies as `v.any()` so the Zod schemas in
 * `src/lib/schemas/` stay the single source of truth rather than being forked
 * into a second, hand-maintained set of Convex validators. The price of that is
 * stated plainly in the schema header: **Convex cannot reject a malformed body,
 * so the mutation has to.** These functions are where that obligation is paid.
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
 */

const OWNABLE = v.union(v.literal('pilots'), v.literal('mechs'))
type OwnableTable = 'pilots' | 'mechs'

const PARSERS = {
  pilots: PilotSchema,
  mechs: MechSchema,
} as const

/** Parse a body against its Zod schema, or throw with a legible reason. */
function parseBody(table: OwnableTable, body: unknown): unknown {
  const result = PARSERS[table].safeParse(body)
  if (!result.success) {
    throw new Error(`Invalid ${table} payload: ${result.error.issues[0]?.message ?? 'unknown'}`)
  }
  return result.data
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

async function assertGameMemberOrShelfOwner(
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

    return {
      pilots: pilots.map((p) => ({ _id: p._id, ownerId: p.ownerId, body: p.body })),
      mechs: mechs.map((m) => ({ _id: m._id, ownerId: m.ownerId, body: m.body })),
      crawlers: crawlers.map((c) => ({ _id: c._id, body: c.body })),
      softLinks: softLinks.map((l) => ({ _id: l._id, from: l.from, to: l.to, type: l.type })),
    }
  },
})

/** The caller's own shelf — entities that belong to them and to no Game. */
export const listShelf = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx)

    const pilots = (
      await ctx.db
        .query('pilots')
        .withIndex('by_owner', (q) => q.eq('ownerId', userId))
        .collect()
    ).filter((p) => p.gameId === null)
    const mechs = (
      await ctx.db
        .query('mechs')
        .withIndex('by_owner', (q) => q.eq('ownerId', userId))
        .collect()
    ).filter((m) => m.gameId === null)

    return {
      pilots: pilots.map((p) => ({ _id: p._id, body: p.body })),
      mechs: mechs.map((m) => ({ _id: m._id, body: m.body })),
    }
  },
})

/** Create an entity, on the caller's shelf or in a Game they belong to. */
export const create = mutation({
  args: {
    table: OWNABLE,
    gameId: v.union(v.id('games'), v.null()),
    /** The local UUID this row mirrors, so later edits can address it. */
    appId: v.optional(v.string()),
    body: v.any(),
  },
  handler: async (ctx, args): Promise<Id<'pilots'> | Id<'mechs'>> => {
    const userId = await requireUser(ctx)
    await assertGameMemberOrShelfOwner(ctx, args.gameId, userId)
    const body = parseBody(args.table, args.body)

    return await ctx.db.insert(args.table, {
      gameId: args.gameId,
      ownerId: userId,
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
    const doc = await ctx.db.get(args.entityId as Id<'pilots'> | Id<'mechs'>)
    if (doc === null) throw new Error('That entity no longer exists')

    assertMayWrite(doc as Doc<'pilots'> | Doc<'mechs'>, userId)
    const body = parseBody(args.table, args.body)

    await ctx.db.patch(doc._id, { body, updatedAt: Date.now() })
  },
})

export const remove = mutation({
  args: { table: OWNABLE, entityId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx)
    const doc = await ctx.db.get(args.entityId as Id<'pilots'> | Id<'mechs'>)
    if (doc === null) return

    assertMayWrite(doc as Doc<'pilots'> | Doc<'mechs'>, userId)
    await ctx.db.delete(doc._id)
  },
})

/**
 * Write the communal crawler with a **field-level merge** (D19).
 *
 * Last-write-wins would be wrong here in a way that shows up on exactly the
 * night it matters: during Downtime the whole crew touches the crawler within
 * the same few minutes, and a full-body write would silently discard whichever
 * member happened to lose the race. Merging per top-level field means two
 * people editing different things both succeed, and only a genuine same-field
 * collision contends.
 */
export const patchCrawler = mutation({
  args: {
    crawlerId: v.id('crawlers'),
    patch: v.any(),
  },
  handler: async (ctx, args): Promise<void> => {
    const doc = await ctx.db.get(args.crawlerId)
    if (doc === null) throw new Error('That crawler no longer exists')

    // Communal: membership is the whole check. No ownerId to consult.
    await requireMember(ctx, doc.gameId)

    const merged = { ...(doc.body as Record<string, unknown>), ...(args.patch as object) }
    const result = CrawlerSchema.safeParse(merged)
    if (!result.success) {
      throw new Error(`Invalid crawler payload: ${result.error.issues[0]?.message ?? 'unknown'}`)
    }

    await ctx.db.patch(args.crawlerId, { body: result.data, updatedAt: Date.now() })
  },
})

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
 */
export const claimLocal = mutation({
  args: {
    pilots: v.array(v.any()),
    mechs: v.array(v.any()),
  },
  handler: async (ctx, args): Promise<{ claimed: number; skipped: number }> => {
    const userId = await requireUser(ctx)
    const now = Date.now()
    let claimed = 0
    let skipped = 0

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
        await ctx.db.insert(table, {
          gameId: null,
          ownerId: userId,
          body: parsed.data,
          updatedAt: now,
        })
        claimed += 1
      }
    }

    return { claimed, skipped }
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
    await assertGameMemberOrShelfOwner(ctx, args.gameId, userId)
    const body = parseBody(args.table, args.body)

    const existing = await byAppId(ctx, args.table, args.appId)
    if (existing === null) {
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
    await ctx.db.patch(existing._id, { body, updatedAt: Date.now() })
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
