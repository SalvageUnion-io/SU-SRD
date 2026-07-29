import { v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import {
  NotAuthorized,
  getMembership,
  requireMember,
  requireOrganizer,
  requireUser,
} from './model/permissions'

/**
 * Games — the shared container (ADR-030 §2).
 *
 * A Game collapses campaign, group, and the former Workspace into one concept.
 * The personal **Shelf** is the other container and is not a Game: it is simply
 * the absence of one (`gameId: null` on an entity), which is why there is no
 * `shelves` table.
 */

/** Shape returned to the client for a Game the caller belongs to. */
type GameSummary = {
  _id: Id<'games'>
  name: string
  templateOrigin: string | undefined
  mediator: boolean
  organizer: boolean
  memberCount: number
  /** The communal crawler's name, or null before one exists. */
  crawlerName: string | null
  pilotCount: number
  mechCount: number
}

/**
 * Collapse a Game + the caller's membership into the row the Games list draws.
 *
 * The crawler name and the two counts exist because a Game lists as an
 * `EntityRow` whose badges are "crawler · n pilots · n mechs" — the row has to
 * say what the table *is*, not just what it is called.
 *
 * **Counting means collecting.** Convex has no count API, so each count is a
 * `by_game` scan whose rows are then discarded, and `listMine` runs this once
 * per Game you belong to. That is fine at a table's scale (a Game holds single
 * digits of each) and is the honest cost of the badges; if it ever bites, the
 * fix is a denormalised counter on `games`, not a cleverer query here.
 */
async function summarize(
  ctx: MutationCtx | Parameters<typeof requireMember>[0],
  game: Doc<'games'>,
  membership: Doc<'memberships'>
): Promise<GameSummary> {
  const [members, pilots, mechs, crawlers] = await Promise.all([
    ctx.db
      .query('memberships')
      .withIndex('by_game', (q) => q.eq('gameId', game._id))
      .collect(),
    ctx.db
      .query('pilots')
      .withIndex('by_game', (q) => q.eq('gameId', game._id))
      .collect(),
    ctx.db
      .query('mechs')
      .withIndex('by_game', (q) => q.eq('gameId', game._id))
      .collect(),
    ctx.db
      .query('crawlers')
      .withIndex('by_game', (q) => q.eq('gameId', game._id))
      .collect(),
  ])

  // The name lives in the opaque body Convex cannot validate (ADR-030), so read
  // it defensively rather than trusting the shape — the same move `crew.vitals`
  // makes for pilot and mech names.
  const crawlerBody = crawlers[0]?.body as Record<string, unknown> | null | undefined
  const rawName = crawlerBody?.name
  const crawlerName = typeof rawName === 'string' && rawName.length > 0 ? rawName : null

  return {
    _id: game._id,
    name: game.name,
    templateOrigin: game.templateOrigin,
    mediator: membership.mediator,
    organizer: membership.organizer,
    memberCount: members.length,
    crawlerName,
    pilotCount: pilots.length,
    mechCount: mechs.length,
  }
}

/** Every Game the signed-in user belongs to, with their role in each. */
export const listMine = query({
  args: {},
  handler: async (ctx): Promise<GameSummary[]> => {
    const userId = await requireUser(ctx)
    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()

    const out: GameSummary[] = []
    for (const membership of memberships) {
      const game = await ctx.db.get(membership.gameId)
      // A membership whose game is gone is a bug, not a state to render.
      if (game === null) continue
      out.push(await summarize(ctx, game, membership))
    }
    return out
  },
})

/**
 * One Game, for its own route.
 *
 * Returns `null` rather than throwing when the caller is not a member, because
 * a bookmarked `/games/<id>` for a Game you left is an ordinary thing to visit,
 * not an error to surface. `null` also covers "no such Game", deliberately: a
 * non-member must not be able to tell an existing Game from a deleted one.
 */
export const get = query({
  args: { gameId: v.id('games') },
  handler: async (ctx, args): Promise<GameSummary | null> => {
    const userId = await requireUser(ctx)
    const membership = await getMembership(ctx, args.gameId, userId)
    if (membership === null) return null
    const game = await ctx.db.get(args.gameId)
    if (game === null) return null
    return await summarize(ctx, game, membership)
  },
})

/**
 * Create a Game. The creator becomes its **Organizer**, and — per ADR-030 —
 * Organizer is a modifier on a base role rather than a role of its own, so
 * they are seated as a Player at the same time. `mediator` starts false: many
 * tables decide who runs it after the Game exists, and ownership assignment
 * falls back to the Organizer until someone is appointed.
 */
export const create = mutation({
  args: {
    name: v.string(),
    templateOrigin: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<'games'>> => {
    const userId = await requireUser(ctx)
    const name = args.name.trim()
    if (name.length === 0) throw new Error('A game needs a name')

    const gameId = await ctx.db.insert('games', {
      name,
      templateOrigin: args.templateOrigin,
    })
    await ctx.db.insert('memberships', {
      gameId,
      userId,
      mediator: false,
      organizer: true,
      joinedAt: Date.now(),
    })
    return gameId
  },
})

export const rename = mutation({
  args: { gameId: v.id('games'), name: v.string() },
  handler: async (ctx, args): Promise<void> => {
    await requireOrganizer(ctx, args.gameId)
    const name = args.name.trim()
    if (name.length === 0) throw new Error('A game needs a name')
    await ctx.db.patch(args.gameId, { name })
  },
})

/**
 * Delete a Game and everything scoped to it.
 *
 * Entities owned by members are **not** silently destroyed — they fall back to
 * their owner's shelf (`gameId: null`), so deleting a campaign never deletes
 * somebody's character. Unclaimed entities have no shelf to fall back to and
 * are removed with the Game, which is the only place ADR-030's "both columns
 * null is invalid" rule could otherwise be violated.
 */
export const destroy = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args): Promise<void> => {
    await requireOrganizer(ctx, args.gameId)

    for (const table of ['pilots', 'mechs'] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
        .collect()
      for (const row of rows) {
        if (row.ownerId === null) await ctx.db.delete(row._id)
        else await ctx.db.patch(row._id, { gameId: null })
      }
    }

    // Game-scoped rows with no personal counterpart just go. `inviteRedemptions`
    // and `joinRequests` belong here for the same reason `invites` does: they
    // describe a way into a Game that no longer exists, and an unanswered knock
    // at a deleted door would sit pending forever.
    for (const table of [
      'crawlers',
      'encounterNpcs',
      'softLinks',
      'invites',
      'inviteRedemptions',
      'joinRequests',
      'memberships',
      'presence',
    ] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
        .collect()
      for (const row of rows) await ctx.db.delete(row._id)
    }

    await ctx.db.delete(args.gameId)
  },
})

/** The Game's roster, with each member's role. Any member may read it. */
export const members = query({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.gameId)
    const rows = await ctx.db
      .query('memberships')
      .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
      .collect()

    return await Promise.all(
      rows.map(async (m) => {
        const user = await ctx.db.get(m.userId)
        return {
          userId: m.userId,
          displayName: user?.displayName ?? user?.name ?? 'Unknown pilot',
          avatarUrl: user?.avatarUrl ?? user?.image,
          mediator: m.mediator,
          organizer: m.organizer,
          joinedAt: m.joinedAt,
        }
      })
    )
  },
})

/** Appoint (or stand down) a Mediator. Administrative — Organizer only. */
export const setMediator = mutation({
  args: { gameId: v.id('games'), userId: v.id('users'), mediator: v.boolean() },
  handler: async (ctx, args): Promise<void> => {
    await requireOrganizer(ctx, args.gameId)
    const target = await getMembership(ctx, args.gameId, args.userId)
    if (target === null) throw new NotAuthorized('That user is not a member of this game')
    await ctx.db.patch(target._id, { mediator: args.mediator })
  },
})

/**
 * Hand the Organizer flag to another member.
 *
 * Both patches happen in the same mutation — Convex mutations are
 * transactional, so there is no window in which a Game has two Organizers or
 * none. That invariant is the whole reason this is one function rather than a
 * clear-then-set pair the client could half-complete.
 */
export const transferOrganizer = mutation({
  args: { gameId: v.id('games'), userId: v.id('users') },
  handler: async (ctx, args): Promise<void> => {
    const current = await requireOrganizer(ctx, args.gameId)
    if (current.userId === args.userId) return

    const target = await getMembership(ctx, args.gameId, args.userId)
    if (target === null) throw new NotAuthorized('That user is not a member of this game')

    await ctx.db.patch(current._id, { organizer: false })
    await ctx.db.patch(target._id, { organizer: true })
  },
})
