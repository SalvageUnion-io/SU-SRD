import { v } from 'convex/values'
import { SCENE_CONDITION_IDS } from 'game-domain/schemas/scene'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { query } from './_generated/server'
import { mutation } from './model/entities'
import { membershipOrNull, requireMediator } from './model/permissions'
import { sceneCondition } from './model/playTables'

/**
 * A Game's Scene conditions (play.md §10): the environment the table is in,
 * a Radiation Storm or Freezing or Low Visibility, which the Mediator switches
 * on and off and every seat reads (its Heat and range follow it).
 *
 * The Mediator also passes the hours (`passHour`), which only counts them: what
 * an hour costs each unit reaches a player's sheet as the Mediator's proposals,
 * never as a write here (ADR-030 §4, ADR-007).
 */

async function sceneRow(
  ctx: QueryCtx | MutationCtx,
  gameId: Id<'games'>
): Promise<Doc<'scenes'> | null> {
  return await ctx.db
    .query('scenes')
    .withIndex('by_game', (q) => q.eq('gameId', gameId))
    .unique()
}

const SCENE_STATE = v.object({
  conditions: v.array(sceneCondition),
  hours: v.number(),
})

/** The Game's conditions, in catalogue order, and the hours passed under them; a clear Scene for a non-member too. */
export const current = query({
  args: { gameId: v.id('games') },
  returns: SCENE_STATE,
  handler: async (ctx, args) => {
    const clear = { conditions: [], hours: 0 }
    if ((await membershipOrNull(ctx, args.gameId)) === null) return clear
    const row = await sceneRow(ctx, args.gameId)
    if (row === null) return clear
    return { conditions: row.conditions, hours: row.hours }
  },
})

/**
 * Put the Scene under exactly these conditions, the Mediator's alone. Each is
 * kept once, in catalogue order; clearing the last one clears the hours.
 */
export const setConditions = mutation({
  args: { gameId: v.id('games'), conditions: v.array(sceneCondition) },
  handler: async (ctx, args): Promise<void> => {
    await requireMediator(ctx, args.gameId)
    const conditions = SCENE_CONDITION_IDS.filter((id) => args.conditions.includes(id))
    const row = await sceneRow(ctx, args.gameId)
    const hours = conditions.length === 0 ? 0 : (row?.hours ?? 0)
    const next = { conditions, hours, updatedAt: Date.now() }
    if (row === null) await ctx.db.insert('scenes', { gameId: args.gameId, ...next })
    else await ctx.db.patch(row._id, next)
  },
})

/** Count an hour passed under the Scene's conditions; returns the hour it now is, or 0 with none to pass under. */
export const passHour = mutation({
  args: { gameId: v.id('games') },
  returns: v.number(),
  handler: async (ctx, args): Promise<number> => {
    await requireMediator(ctx, args.gameId)
    const row = await sceneRow(ctx, args.gameId)
    if (row === null || row.conditions.length === 0) return 0
    const hours = row.hours + 1
    await ctx.db.patch(row._id, { hours, updatedAt: Date.now() })
    return hours
  },
})
