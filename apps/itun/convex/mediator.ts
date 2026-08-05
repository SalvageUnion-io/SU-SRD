import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { parseBody } from './model/entities'
import { requireMediator, requireMember, requireUser } from './model/permissions'

/**
 * The Mediator surface's server layer (ADR-030 §6, Phase 3).
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
 * ## Presence is deliberately not a subscription to everything
 *
 * "Who is at the table right now" is a heartbeat, not a stream of activity.
 * Storing a `lastSeen` and letting readers decide what counts as present keeps
 * it cheap and avoids inventing an online/offline state the app would then have
 * to keep truthful.
 *
 * ## The tray owes the same edge parse every other write does
 *
 * `encounterNpcs.body` is `v.any()`, so Convex cannot reject a malformed one —
 * `schema.ts` says in that many words that the mutation must. These two wrote
 * straight through for a while, which meant the one table only a Mediator can
 * see was also the one nothing validated. `parseBody` is shared with
 * `entities.ts`; what it accepts here is deliberately looser than the local
 * store's record, and `model/entities.ts` says why.
 */

/** How long since a heartbeat before somebody stops counting as at the table. */
export const PRESENCE_WINDOW_MS = 90_000

/** The Mediator's prepared opposition. Mediator-only, by design. */
export const npcs = query({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    await requireMediator(ctx, args.gameId)
    const rows = await ctx.db
      .query('encounterNpcs')
      .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
      .collect()
    return rows.map((r) => ({ _id: r._id, body: r.body }))
  },
})

export const addNpc = mutation({
  args: { gameId: v.id('games'), body: v.any() },
  handler: async (ctx, args): Promise<Id<'encounterNpcs'>> => {
    await requireMediator(ctx, args.gameId)
    const body = parseBody('encounterNpcs', args.body)
    return await ctx.db.insert('encounterNpcs', { gameId: args.gameId, body })
  },
})

export const updateNpc = mutation({
  args: { npcId: v.id('encounterNpcs'), body: v.any() },
  handler: async (ctx, args): Promise<void> => {
    const doc = await ctx.db.get(args.npcId)
    if (doc === null) return
    await requireMediator(ctx, doc.gameId)
    const body = parseBody('encounterNpcs', args.body)
    await ctx.db.patch(args.npcId, { body })
  },
})

export const removeNpc = mutation({
  args: { npcId: v.id('encounterNpcs') },
  handler: async (ctx, args): Promise<void> => {
    const doc = await ctx.db.get(args.npcId)
    if (doc === null) return
    await requireMediator(ctx, doc.gameId)
    await ctx.db.delete(args.npcId)
  },
})

/**
 * Record that the caller is at the table.
 *
 * Upserts one row per (game, member) rather than appending, so presence cannot
 * grow without bound during a long session. Any member may heartbeat — presence
 * is not privileged information, and a Mediator needs to see players arrive
 * exactly as much as players need to see each other.
 */
export const heartbeat = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args): Promise<void> => {
    const membership = await requireMember(ctx, args.gameId)
    const existing = await ctx.db
      .query('presence')
      .withIndex('by_game_user', (q) => q.eq('gameId', args.gameId).eq('userId', membership.userId))
      .unique()

    if (existing === null) {
      await ctx.db.insert('presence', {
        gameId: args.gameId,
        userId: membership.userId,
        lastSeen: Date.now(),
      })
      return
    }
    await ctx.db.patch(existing._id, { lastSeen: Date.now() })
  },
})

/**
 * Who is at the table.
 *
 * `present` is computed at read time from `lastSeen` rather than stored. A
 * stored boolean would need something to turn it off — a timer, a disconnect
 * hook — and every one of those can fail in a way that leaves somebody
 * permanently "present" long after they closed the tab.
 */
export const presence = query({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.gameId)
    const now = Date.now()

    const rows = await ctx.db
      .query('presence')
      .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
      .collect()

    return await Promise.all(
      rows.map(async (r) => {
        const user = await ctx.db.get(r.userId)
        return {
          userId: r.userId,
          displayName: user?.displayName ?? user?.name ?? 'Crewmate',
          lastSeen: r.lastSeen,
          present: now - r.lastSeen < PRESENCE_WINDOW_MS,
        }
      })
    )
  },
})

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
  handler: async (ctx, args): Promise<boolean> => {
    const userId = await requireUser(ctx)
    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_game_user', (q) => q.eq('gameId', args.gameId).eq('userId', userId))
      .unique()
    return membership?.mediator ?? false
  },
})
