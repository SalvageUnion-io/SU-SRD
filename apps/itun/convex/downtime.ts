import { v } from 'convex/values'
import { SalvageUnionReference } from 'salvageunion-reference'
import { isUpkeepStep, UPKEEP_STEP_NAME } from '../src/lib/rules/downtime'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { query } from './_generated/server'
import { mutation } from './model/entities'
import { NotAuthorized, requireMediator, requireMember } from './model/permissions'
import { loadReferenceData } from './model/referenceData'

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
 * crawler is the crew's, so its upkeep is one cost paid once — six members
 * each spending it is the exact double-charging that made per-player Downtime
 * unworkable. Since the crawler became the Mediator's (ADR-038 §5) only the
 * Mediator pays it, and the flag still guards a second tab or a second press.
 * The flag resets when a new Downtime starts, never when a step advances.
 *
 * Upkeep is a step of the procedure ("Upkeep & Upgrade", p.227), so the Game's
 * Upkeep is paid in that step and refused in every other. The crawler sheet is
 * not gated: it stays editable at any time.
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

/**
 * How many steps the Crawler Downtime procedure has.
 *
 * The book is the source: Core Book p.227-228 walks ten named steps, "Tally
 * Salvage" through "Prepare for the next Salvage Run", and says explicitly that
 * you "may go back to any of these steps". The dataset carries them as the
 * Crawler Downtime guide, which is what `DowntimeWizard` renders and what the
 * SRD publishes, and Convex reads the same guide (`model/referenceData.ts`).
 * This was a hard-coded mirror, with a test to stop it drifting, while Convex
 * did not load the dataset.
 */
function downtimeStepCount(): number {
  loadReferenceData()
  const steps = SalvageUnionReference.Guides.find((g) => g.guideType === 'downtime')?.steps
  if (!steps || steps.length === 0) throw new Error('The Crawler Downtime guide has no steps')
  return steps.length
}

/** Move the whole table to the next step. */
export const advance = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args): Promise<void> => {
    await requireMediator(ctx, args.gameId)
    const row = await readState(ctx, args.gameId)
    if (row === null || row.stepIndex === null) {
      throw new NotAuthorized('Downtime is not running')
    }

    // Clamp at the last step rather than running past the end. `stepIndex` was
    // unbounded, so `advance` could be called indefinitely and the Mediator's
    // panel would render "Step 14 / 10" while the solo wizard — which clamps
    // client-side — showed step 10. Same procedure, two surfaces, two answers.
    const next = Math.min(row.stepIndex + 1, downtimeStepCount() - 1)
    if (next === row.stepIndex) return

    await ctx.db.patch(row._id, {
      stepIndex: next,
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
 * Record that the crew has paid crawler upkeep this Downtime. Mediator only:
 * the crawler is theirs (ADR-038 §5, `assertMayEditCrawler`). Only in the
 * Upkeep & Upgrade step: any other step refuses it (see the module header).
 *
 * Returns false when it was already spent rather than throwing: a second press,
 * or the hub and the Dashboard open side by side, is an ordinary race, not an
 * error to show anybody. The caller uses the result to decide whether to also
 * deduct the scrap.
 */
export const spendUpkeep = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args): Promise<boolean> => {
    await requireMediator(ctx, args.gameId)
    const row = await readState(ctx, args.gameId)
    if (row === null || row.stepIndex === null) {
      throw new NotAuthorized('Downtime is not running')
    }
    loadReferenceData()
    if (!isUpkeepStep(row.stepIndex)) {
      throw new NotAuthorized(`Upkeep is paid in the ${UPKEEP_STEP_NAME} step`)
    }
    if (row.upkeepSpent) return false

    await ctx.db.patch(row._id, { upkeepSpent: true })
    return true
  },
})
