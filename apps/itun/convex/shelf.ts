import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { query } from './_generated/server'
import type { PatternVisibility } from './model/entities'
import {
  bodyAppId,
  findOwnedByAppId,
  mutation,
  PARSERS,
  parseBody,
  patternVisibilityOf,
} from './model/entities'
import { NotAuthorized, requireMemberAs, requireUser } from './model/permissions'

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
 * Who may read one of the caller's patterns (#1276, board P1): only them, anyone
 * with the link, or one Game's crew.
 *
 * The maker's act and nobody else's, like publishing a sheet (ADR-032 §2) — a
 * pattern has no communal case. Going public parses the body first, as
 * `publicSheet.setPublic` does, and for the same reason: a body the page cannot
 * render should fail here, where the maker is standing, not on a link they have
 * already handed out. Sharing with a crew needs the maker to be in that crew.
 *
 * Narrowing is always allowed and needs no parse: it only reduces who can read.
 */
export const setPatternVisibility = mutation({
  args: {
    patternId: v.string(),
    visibility: v.union(v.literal('private'), v.literal('link'), v.literal('game')),
    gameId: v.optional(v.id('games')),
  },
  handler: async (ctx, args): Promise<{ visibility: PatternVisibility }> => {
    const userId = await requireUser(ctx)
    const row = await findOwnedByAppId(ctx, 'mechPatterns', userId, args.patternId)
    if (row === null) throw new NotAuthorized('That pattern no longer exists')

    let gameId: Id<'games'> | null = null
    if (args.visibility === 'game') {
      if (args.gameId === undefined) throw new ConvexError('Choose which Game to share it with')
      await requireMemberAs(ctx, args.gameId, userId)
      gameId = args.gameId
    }
    if (args.visibility !== 'private') {
      try {
        parseBody('mechPatterns', row.body)
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'unknown'
        throw new ConvexError(`This pattern cannot be shared: ${detail}`)
      }
    }

    await ctx.db.patch(row._id, {
      publicRead: args.visibility === 'link',
      gameId,
      sharedAt: args.visibility === 'private' ? undefined : Date.now(),
    })
    return { visibility: args.visibility }
  },
})

/**
 * The patterns crewmates have shared with the caller's Games (#1276: "My Game's
 * crew"), for the patterns page. The caller's own are on their shelf already and
 * are left out. Signed out, there is no crew: an empty list.
 */
export const crewPatterns = query({
  args: {},
  handler: async (
    ctx
  ): Promise<Array<{ appId: string; body: unknown; madeBy: string; gameName: string }>> => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) return []
    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()
    const out: Array<{ appId: string; body: unknown; madeBy: string; gameName: string }> = []
    for (const membership of memberships) {
      const game = await ctx.db.get(membership.gameId)
      if (game === null) continue
      const rows = await ctx.db
        .query('mechPatterns')
        .withIndex('by_game', (q) => q.eq('gameId', membership.gameId))
        .collect()
      for (const row of rows) {
        if (row.ownerId === userId) continue
        const maker = await ctx.db.get(row.ownerId)
        out.push({
          appId: row.appId,
          body: row.body,
          madeBy: maker?.displayName ?? maker?.name ?? 'A crewmate',
          gameName: game.name,
        })
      }
    }
    return out
  },
})

/**
 * Who can read each of the caller's own patterns, and how many mechs have been
 * built from it — the chips under a pattern on the Shelves page (#1279, board
 * S1: "Shared by link", "Only me", "Built twice"). Those facts live in the
 * row's columns rather than its body, so the local pattern cache cannot answer
 * them. Signed out there is no shelf: an empty list.
 */
export const patternSharing = query({
  args: {},
  handler: async (
    ctx
  ): Promise<
    Array<{
      appId: string
      visibility: PatternVisibility
      gameName: string | null
      builtCount: number
    }>
  > => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) return []
    const rows = await ctx.db
      .query('mechPatterns')
      .withIndex('by_owner_app_id', (q) => q.eq('ownerId', userId))
      .collect()
    return await Promise.all(
      rows.map(async (row) => {
        const game = row.gameId === null ? null : await ctx.db.get(row.gameId)
        return {
          appId: row.appId,
          visibility: patternVisibilityOf(row),
          gameName: game?.name ?? null,
          builtCount: row.builtCount ?? 0,
        }
      })
    )
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
