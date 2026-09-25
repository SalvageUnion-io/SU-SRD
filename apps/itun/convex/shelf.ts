import { v } from 'convex/values'
import { bodyAppId, findOwnedByAppId, mutation, PARSERS } from './model/entities'
import { requireUser } from './model/permissions'

/**
 * The per-write mirror for the two shelf-only collections: saved mech patterns
 * and the personal NPC tray (ADR-034 P4b).
 *
 * Both are owned by one account, live on its shelf (`gameId: null`), and are
 * addressed by the id inside their body rather than by an `appId` the client
 * minted for a server row — which is why they share none of the ownable-entity
 * machinery in `entities.ts` and were split out of it (audit AP-07). A tray
 * inside a Game is the Mediator's, and is reached through `mediator.*`.
 */

/**
 * Mirror one saved pattern, addressed by the id inside its body.
 *
 * These tables have no `appId` column and need none: a pattern's own id already
 * is its app id, which makes this naturally idempotent — the same write twice
 * is a patch, not a duplicate.
 *
 * Until this existed, `mechPatterns` reached Convex through exactly one path,
 * the bulk `claimLocal` at sign-in. Every pattern saved afterwards lived only in
 * that browser: invisible on a second device, and gone with the site data. This
 * is the per-write half ADR-034 P4b calls for.
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
    // `appId` is written on the patch too, so a row from before the column
    // existed gains it the first time it is saved.
    await ctx.db.patch(existing._id, { appId: patternId, body: parsed })
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
 * Mirror one shelf NPC.
 *
 * Shelf only — `ownerId: userId`, `gameId: null`. A tray inside a Game belongs
 * to the table rather than to a member and is reached through `mediator.*` by
 * the Mediator's role; this is the personal tray, which is the one the local
 * store holds and the one that had no server write at all.
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
    await ctx.db.patch(existing._id, { appId: npcId, body: parsed })
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
