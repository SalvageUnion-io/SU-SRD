import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { parseBody } from './model/entities'
import { requireMediator, requireUser } from './model/permissions'

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
 * ## There is no presence here any more
 *
 * A `presence` table, a `heartbeat` mutation and a `presence` query used to
 * live in this file, with the design note that storing `lastSeen` and letting
 * readers decide what counts as present avoids inventing an online/offline
 * state the app has to keep truthful. The reasoning was sound; the feature was
 * never finished. **No client ever called `heartbeat`** — not the web app, not
 * the bot — so the table had no writer, the query always returned nothing, and
 * `PresenceList` returned null on every render.
 *
 * It was not merely invisible. `botClient.channel` *read* it, so `/su game
 * channel` rendered "0 at the table" and no `●` markers no matter who was
 * actually there — a permanently-false indicator, which is worse than an absent
 * one. All of it is gone rather than left as scaffolding. Rebuild it with the
 * writer in the same change.
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
