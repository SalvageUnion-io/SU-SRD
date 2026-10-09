import { v } from 'convex/values'
import { bodyAppId, findOwnedByAppId, mutation, PARSERS } from './model/entities'
import { requireUser } from './model/permissions'

/**
 * The server-first writes for the two shelf-only collections: saved mech
 * patterns and the personal NPC tray (ADR-034).
 *
 * Both are owned by one account, live on its shelf (`gameId: null`), and are
 * addressed by the id inside their body rather than by an `appId` the client
 * minted for a server row — which is why they share none of the ownable-entity
 * machinery in `entities.ts`. A tray
 * inside a Game is the Mediator's, and is reached through `mediator.*`.
 */

/**
 * Write one saved pattern, addressed by the id inside its body.
 *
 * That id is lifted into the row's `appId` column and found through
 * `by_owner_app_id`, which makes this idempotent — the same write twice is a
 * patch, not a duplicate.
 */
export const upsertMechPattern = mutation({
  args: { body: v.any() },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx)
    const parsed = PARSERS.mechPatterns.parse(args.body)
    const patternId = bodyAppId(args.body)
    if (patternId === undefined) {
      throw new Error('[itun] a mech pattern must carry a string id in its body')
    }

    const existing = await findOwnedByAppId(ctx, 'mechPatterns', userId, patternId)
    if (existing === null) {
      await ctx.db.insert('mechPatterns', {
        ownerId: userId,
        gameId: null,
        appId: patternId,
        body: parsed,
      })
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
    const existing = await findOwnedByAppId(ctx, 'mechPatterns', userId, args.patternId)
    // Absent is success: a delete that races a delete, or a row that never
    // reached the server, must not fail the local write that follows it.
    if (existing === null) return
    await ctx.db.delete(existing._id)
  },
})

/**
 * Write one shelf NPC.
 *
 * Shelf only — `ownerId: userId`, `gameId: null`. A tray inside a Game belongs
 * to the table rather than to a member and is reached through `mediator.*` by
 * the Mediator's role; this is the personal tray, the one the local store
 * holds.
 */
export const upsertEncounterNpc = mutation({
  args: { body: v.any() },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx)
    const parsed = PARSERS.encounterNpcs.parse(args.body)
    const npcId = bodyAppId(args.body)
    if (npcId === undefined) {
      throw new Error('[itun] an encounter NPC must carry a string id in its body')
    }

    const existing = await findOwnedByAppId(ctx, 'encounterNpcs', userId, npcId)
    if (existing === null) {
      await ctx.db.insert('encounterNpcs', {
        gameId: null,
        ownerId: userId,
        appId: npcId,
        body: parsed,
      })
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
    const existing = await findOwnedByAppId(ctx, 'encounterNpcs', userId, args.npcId)
    if (existing === null) return
    await ctx.db.delete(existing._id)
  },
})
