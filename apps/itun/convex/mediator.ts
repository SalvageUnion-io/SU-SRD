import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import { parseBody } from './model/entities'
import { NotAuthorized, requireMediator, requireUser } from './model/permissions'

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
    // `ownerId: null` is what in-a-Game means for a tray NPC — the opposition
    // belongs to the table, and the Mediator reaches it through their role.
    // These mutations are all Game-scoped; the shelf half of the container model
    // has no writer yet and gains one when the client tray is wired (P4).
    return await ctx.db.insert('encounterNpcs', {
      gameId: args.gameId,
      ownerId: null,
      body,
    })
  },
})

export const updateNpc = mutation({
  args: { npcId: v.id('encounterNpcs'), body: v.any() },
  handler: async (ctx, args): Promise<void> => {
    const doc = await ctx.db.get(args.npcId)
    if (doc === null) return
    await requireNpcWriter(ctx, doc)
    const body = parseBody('encounterNpcs', args.body)
    await ctx.db.patch(args.npcId, { body })
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
  handler: async (ctx, args): Promise<boolean> => {
    const userId = await requireUser(ctx)
    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_game_user', (q) => q.eq('gameId', args.gameId).eq('userId', userId))
      .unique()
    return membership?.mediator ?? false
  },
})
