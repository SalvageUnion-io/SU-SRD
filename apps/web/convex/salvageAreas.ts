import { ConvexError, v } from 'convex/values'
import { SalvageAreaSchema } from 'game-domain/schemas/salvageArea'
import type { Doc } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { query } from './_generated/server'
import { mutation } from './model/entities'
import { membershipOrNull, requireMediator, requireUser } from './model/permissions'
import type { SeatPlace } from './model/seats'
import { writablePilot } from './seats'

/**
 * The area a table is salvaging (Core Book p.245): its Tech Level and its
 * Supply, the rolls it has left. Like `downtime.ts`, every function takes the
 * place: a Game (`gameId`), whose area its Mediator sets and every member
 * reads, or null for the caller's own solo table, which they set themselves.
 *
 * ## Supply is spent on the server, one roll at a time
 *
 * "Each time a Pilot rolls to Area Salvage, reduce the Supply by 1. When the
 * value is 0, the area cannot be Area Salvaged anymore." Two players rolling
 * at once must not both spend the last Supply, so the roll spends it here
 * first (`spend`), and the client rolls only once the spend lands. The answer
 * carries the Tech Level the Supply was spent on, so a Mediator changing the
 * area mid-roll never changes what that roll finds.
 */

const AREA = v.object({ name: v.string(), techLevel: v.number(), supply: v.number() })

const PLACE_ARGS = { gameId: v.union(v.id('games'), v.null()) }

async function rowAt(
  ctx: QueryCtx | MutationCtx,
  place: SeatPlace
): Promise<Doc<'salvageAreas'> | null> {
  if ('gameId' in place) {
    return await ctx.db
      .query('salvageAreas')
      .withIndex('by_game', (q) => q.eq('gameId', place.gameId))
      .first()
  }
  return await ctx.db
    .query('salvageAreas')
    .withIndex('by_owner', (q) => q.eq('ownerId', place.ownerId))
    .first()
}

function areaOf(row: Doc<'salvageAreas'>) {
  return { name: row.name, techLevel: row.techLevel, supply: row.supply }
}

/**
 * The area being salvaged at a place, or null when there is none: a Game's
 * for its members, the caller's own solo table's when `gameId` is null.
 */
export const here = query({
  args: PLACE_ARGS,
  returns: v.union(AREA, v.null()),
  handler: async (ctx, args) => {
    if (args.gameId === null) {
      const row = await rowAt(ctx, { ownerId: await requireUser(ctx) })
      return row === null ? null : areaOf(row)
    }
    if ((await membershipOrNull(ctx, args.gameId)) === null) return null
    const row = await rowAt(ctx, { gameId: args.gameId })
    return row === null ? null : areaOf(row)
  },
})

/**
 * Set the area being salvaged, or clear it (`area: null`). A Game's is its
 * Mediator's to set (the Mediator says whether an area can be salvaged,
 * p.245); a solo table's, its player's.
 */
export const set = mutation({
  args: { ...PLACE_ARGS, area: v.union(AREA, v.null()) },
  handler: async (ctx, args): Promise<void> => {
    let place: SeatPlace
    if (args.gameId === null) place = { ownerId: await requireUser(ctx) }
    else {
      await requireMediator(ctx, args.gameId)
      place = { gameId: args.gameId }
    }
    const row = await rowAt(ctx, place)
    if (args.area === null) {
      if (row !== null) await ctx.db.delete(row._id)
      return
    }
    const parsed = SalvageAreaSchema.safeParse({ ...args.area, name: args.area.name.trim() })
    if (!parsed.success) throw new ConvexError('An area has a Tech Level of 1 to 6 and a Supply')
    const fields = { ...parsed.data, updatedAt: Date.now() }
    if (row !== null) await ctx.db.patch(row._id, fields)
    else await ctx.db.insert('salvageAreas', { ...place, ...fields })
  },
})

/**
 * Spend 1 Supply for one Area Salvage roll by `pilotId`, whom the caller must
 * be able to play (`writablePilot`), and answer the Tech Level it was spent
 * on and the Supply left. Refused when there is no area, or it is picked
 * clean: a state refusal, so a plain `ConvexError`.
 */
export const spend = mutation({
  args: { ...PLACE_ARGS, pilotId: v.string() },
  returns: v.object({ techLevel: v.number(), supply: v.number() }),
  handler: async (ctx, args) => {
    const { place } = await writablePilot(ctx, args.gameId, args.pilotId)
    const row = await rowAt(ctx, place)
    if (row === null) throw new ConvexError('There is no area to salvage here')
    if (row.supply <= 0) throw new ConvexError('This area is picked clean')
    const supply = row.supply - 1
    await ctx.db.patch(row._id, { supply, updatedAt: Date.now() })
    return { techLevel: row.techLevel, supply }
  },
})
