import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import { NotAuthorized, requireMediator, requireMember } from './model/permissions'

/**
 * Crew-wide Downtime (ADR-030, Phase 5).
 *
 * Downtime is the one procedure in Salvage Union the whole crew performs **in
 * step**, which is why the phase is Game state advanced by the Mediator rather
 * than something each player tracks alone. Before this, six players ran six
 * private Downtimes and reconciled verbally.
 *
 * ## Upkeep is spent once, not six times
 *
 * `upkeepSpent` is a flag on the *Game's* Downtime, not on each member. The
 * crawler is communal, so its upkeep is one cost the crew pays together — six
 * members each spending it is the exact double-charging that made per-player
 * Downtime unworkable. The flag resets when a new Downtime starts, never when a
 * step advances.
 *
 * ## Completion is per step, not cumulative
 *
 * `completedBy` clears on every advance. Keeping it would leave a player who
 * finished step 1 looking finished for the whole Downtime, which tells the
 * Mediator the opposite of what they need to know.
 */

/** The Game's Downtime row, created lazily on first use. */
async function readState(
  ctx: QueryCtx | MutationCtx,
  gameId: Id<'games'>
): Promise<Doc<'downtime'> | null> {
  return await ctx.db
    .query('downtime')
    .withIndex('by_game', (q) => q.eq('gameId', gameId))
    .unique()
}

async function ensureState(ctx: MutationCtx, gameId: Id<'games'>): Promise<Doc<'downtime'>> {
  const existing = await readState(ctx, gameId)
  if (existing !== null) return existing

  const id = await ctx.db.insert('downtime', {
    gameId,
    stepIndex: null,
    startedAt: null,
    completedBy: [],
    upkeepSpent: false,
  })
  const created = await ctx.db.get(id)
  if (created === null) throw new Error('Failed to create downtime state')
  return created
}

/** The table's current Downtime, plus who has finished the current step. */
export const state = query({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.gameId)
    const row = await readState(ctx, args.gameId)

    // Not-running is a state, so report it rather than returning null and
    // making every caller invent the same default.
    if (row === null) {
      return { running: false, stepIndex: null, completedBy: [], upkeepSpent: false }
    }

    const names: Array<{ userId: Id<'users'>; displayName: string }> = []
    for (const userId of row.completedBy) {
      const user = await ctx.db.get(userId)
      names.push({ userId, displayName: user?.displayName ?? user?.name ?? 'Crewmate' })
    }

    return {
      running: row.stepIndex !== null,
      stepIndex: row.stepIndex,
      startedAt: row.startedAt,
      completedBy: names,
      upkeepSpent: row.upkeepSpent,
    }
  },
})

/** Begin a Downtime. Mediator only — this is a table-wide phase change. */
export const begin = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args): Promise<void> => {
    await requireMediator(ctx, args.gameId)
    const row = await ensureState(ctx, args.gameId)

    // A fresh Downtime is the only thing that clears upkeep. Advancing a step
    // must not, or the crew would be charged again mid-procedure.
    await ctx.db.patch(row._id, {
      stepIndex: 0,
      startedAt: Date.now(),
      completedBy: [],
      upkeepSpent: false,
    })
  },
})

/** Move the whole table to the next step. */
export const advance = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args): Promise<void> => {
    await requireMediator(ctx, args.gameId)
    const row = await readState(ctx, args.gameId)
    if (row === null || row.stepIndex === null) {
      throw new NotAuthorized('Downtime is not running')
    }

    await ctx.db.patch(row._id, {
      stepIndex: row.stepIndex + 1,
      // Per step, not cumulative — see the module header.
      completedBy: [],
    })
  },
})

/** End the Downtime. */
export const end = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args): Promise<void> => {
    await requireMediator(ctx, args.gameId)
    const row = await readState(ctx, args.gameId)
    if (row === null) return
    await ctx.db.patch(row._id, { stepIndex: null, startedAt: null, completedBy: [] })
  },
})

/**
 * Mark yourself done with the current step.
 *
 * Any member, for themselves only — a Mediator cannot tick a player off, which
 * would be the same overreach as writing their sheet. Idempotent, so a
 * double-tap does not add a duplicate.
 */
export const markStepDone = mutation({
  args: { gameId: v.id('games'), done: v.boolean() },
  handler: async (ctx, args): Promise<void> => {
    const membership = await requireMember(ctx, args.gameId)
    const row = await readState(ctx, args.gameId)
    if (row === null || row.stepIndex === null) {
      throw new NotAuthorized('Downtime is not running')
    }

    const without = row.completedBy.filter((id) => id !== membership.userId)
    await ctx.db.patch(row._id, {
      completedBy: args.done ? [...without, membership.userId] : without,
    })
  },
})

/**
 * Record that the crew has paid crawler upkeep this Downtime.
 *
 * Returns false when it was already spent rather than throwing: two players
 * pressing the button at the same moment is an ordinary race at a table, not an
 * error to show anybody. The caller uses the result to decide whether to also
 * deduct the scrap.
 */
export const spendUpkeep = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args): Promise<boolean> => {
    await requireMember(ctx, args.gameId)
    const row = await readState(ctx, args.gameId)
    if (row === null || row.stepIndex === null) {
      throw new NotAuthorized('Downtime is not running')
    }
    if (row.upkeepSpent) return false

    await ctx.db.patch(row._id, { upkeepSpent: true })
    return true
  },
})
