import { ConvexError, v } from 'convex/values'
import { downtimeGuideSteps, isUpkeepStep, UPKEEP_STEP_NAME } from 'game-domain/rules/downtime'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { query } from './_generated/server'
import { displayNameOf } from './account'
import { mutation } from './model/entities'
import { requireMediator, requireMember, requireUser } from './model/permissions'
import { downtimeClaim } from './model/playTables'
import { loadReferenceData } from './model/referenceData'
import type { SeatPlace } from './model/seats'
import { readSeat, writeSeat } from './model/seats'
import { shelfRowOf, writablePilot } from './seats'

/**
 * Crew-wide Downtime (ADR-030).
 *
 * Downtime is the one procedure in Salvage Union the whole crew performs **in
 * step**, which is why the phase is Game state advanced by the Mediator rather
 * than something each player tracks alone. A pilot played solo runs its own,
 * on its solo seat (see "Solo Downtime" below).
 *
 * ## Upkeep is spent once, not six times
 *
 * `upkeepSpent` is a flag on the *Game's* Downtime, not on each member. The
 * crawler is the crew's, so its upkeep is one cost paid once — six members
 * each spending it would charge it six times. The crawler is the Mediator's
 * (ADR-038 §5), so only the Mediator pays it, and the flag guards a second tab
 * or a second press.
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
 *
 * ## A step applies once per pilot
 *
 * What a step applies (Train's +1 TP, Restore) is claimed per pilot before it
 * is applied (`claimStep`, kept in `claimed`), as a solo Downtime's
 * `soloMarkStepDone`. `completedBy` cannot do it: it is per member, it clears
 * on every move, and a player may untick it. `claimed` clears only when a
 * Downtime ends or a fresh one begins, never on a step change or Undo, so
 * Undo, the Mediator's Back and a reload never let a step apply twice.
 */

/**
 * `stepIndex` held to the guide's steps, 0 to the last; the Game's Downtime
 * and a solo one count steps the same way.
 */
function clampStep(stepIndex: number): number {
  loadReferenceData()
  const steps = downtimeGuideSteps()
  if (steps.length === 0) throw new Error('The Crawler Downtime guide has no steps')
  return Math.max(0, Math.min(Math.trunc(stepIndex), steps.length - 1))
}

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

/**
 * The Game's running Downtime: its row and the step the table is on, or a
 * refusal when none is running. A state refusal, not an authorization one, so
 * a plain `ConvexError`.
 */
async function runningGame(
  ctx: MutationCtx,
  gameId: Id<'games'>
): Promise<{ row: Doc<'downtime'>; stepIndex: number }> {
  const row = await readState(ctx, gameId)
  if (row === null || row.stepIndex === null) throw new ConvexError('Downtime is not running')
  return { row, stepIndex: row.stepIndex }
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
  if (created === null) throw new Error('The downtime state could not be created')
  return created
}

/** A Downtime as `state` and `soloState` report it. */
const DOWNTIME_STATE = v.object({
  running: v.boolean(),
  stepIndex: v.union(v.number(), v.null()),
  /** Absent while no Downtime row exists yet. */
  startedAt: v.optional(v.union(v.number(), v.null())),
  completedBy: v.array(v.object({ userId: v.id('users'), displayName: v.string() })),
  upkeepSpent: v.boolean(),
  /** Solo only: the steps marked done this Downtime (`soloMarkStepDone`). */
  doneSteps: v.optional(v.array(v.number())),
  /** A Game's only: each step a pilot has claimed this Downtime (`claimStep`). */
  claimed: v.optional(v.array(downtimeClaim)),
})

/** The table's current Downtime, plus who has finished the current step. */
export const state = query({
  args: { gameId: v.id('games') },
  returns: DOWNTIME_STATE,
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
      names.push({ userId, displayName: displayNameOf(user, 'Crewmate') })
    }

    return {
      running: row.stepIndex !== null,
      stepIndex: row.stepIndex,
      startedAt: row.startedAt,
      completedBy: names,
      upkeepSpent: row.upkeepSpent,
      claimed: row.claimed ?? [],
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
      claimed: [],
    })
  },
})

/** Move the whole table to the next step. */
export const advance = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args): Promise<void> => {
    await requireMediator(ctx, args.gameId)
    const { row, stepIndex } = await runningGame(ctx, args.gameId)

    // Clamp at the last step (`clampStep`, shared with the solo Downtime below).
    const next = clampStep(stepIndex + 1)
    if (next === stepIndex) return

    await ctx.db.patch(row._id, {
      stepIndex: next,
      // Per step, not cumulative — see the module header.
      completedBy: [],
    })
  },
})

/**
 * Put the whole table on a step, back or forward, held to the guide's steps:
 * the Mediator's Back (play.md §10). As `advance`, a move clears who is done,
 * since completion is per step. It never touches upkeep: going back to Upkeep
 * & Upgrade after paying does not let it be paid again (the solo
 * `soloSetStep`'s rule).
 */
export const setStep = mutation({
  args: { gameId: v.id('games'), stepIndex: v.number() },
  handler: async (ctx, args): Promise<void> => {
    await requireMediator(ctx, args.gameId)
    const { row, stepIndex: current } = await runningGame(ctx, args.gameId)
    const stepIndex = clampStep(args.stepIndex)
    if (stepIndex === current) return
    await ctx.db.patch(row._id, { stepIndex, completedBy: [] })
  },
})

/** End the Downtime. */
export const end = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args): Promise<void> => {
    await requireMediator(ctx, args.gameId)
    const row = await readState(ctx, args.gameId)
    if (row === null) return
    await ctx.db.patch(row._id, {
      stepIndex: null,
      startedAt: null,
      completedBy: [],
      claimed: [],
    })
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
    const { row } = await runningGame(ctx, args.gameId)

    const without = row.completedBy.filter((id) => id !== membership.userId)
    await ctx.db.patch(row._id, {
      completedBy: args.done ? [...without, membership.userId] : without,
    })
  },
})

/**
 * Claim the current step for one pilot before applying it (or as it is
 * skipped): the Game's `soloMarkStepDone`. Whoever may write the pilot claims
 * it (`writablePilot`), and only the step the table is on.
 *
 * Returns false when the pilot already claimed this step this Downtime, so
 * the caller applies nothing a second time; only ending a Downtime (`end`)
 * or beginning a fresh one (`begin`) clears a claim (see the module header).
 */
export const claimStep = mutation({
  args: { gameId: v.id('games'), pilotId: v.string(), stepIndex: v.number() },
  handler: async (ctx, args): Promise<boolean> => {
    await writablePilot(ctx, args.gameId, args.pilotId)
    const { row, stepIndex } = await runningGame(ctx, args.gameId)
    if (args.stepIndex !== stepIndex) {
      throw new ConvexError('That is not the step the table is on')
    }
    const claimed = row.claimed ?? []
    const mine = (c: { pilotId: string; stepIndex: number }) =>
      c.pilotId === args.pilotId && c.stepIndex === args.stepIndex
    if (claimed.some(mine)) return false
    await ctx.db.patch(row._id, {
      claimed: [...claimed, { pilotId: args.pilotId, stepIndex: args.stepIndex }],
    })
    return true
  },
})

/**
 * Record that the crew has paid crawler upkeep this Downtime. Mediator only:
 * the crawler is theirs (ADR-038 §5, `assertMayEditCrawler`). Only in the
 * Upkeep & Upgrade step: any other step refuses it (see the module header).
 *
 * Returns false when it was already spent rather than throwing: a second press,
 * or the hub and Play open side by side, is an ordinary race, not an
 * error to show anybody. The caller uses the result to decide whether to also
 * deduct the scrap.
 */
export const spendUpkeep = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args): Promise<boolean> => {
    await requireMediator(ctx, args.gameId)
    const { row, stepIndex } = await runningGame(ctx, args.gameId)
    loadReferenceData()
    if (!isUpkeepStep(stepIndex)) {
      throw new ConvexError(`Upkeep is paid in the ${UPKEEP_STEP_NAME} step`)
    }
    if (row.upkeepSpent) return false

    await ctx.db.patch(row._id, { upkeepSpent: true })
    return true
  },
})

/*
 * ## Solo Downtime
 *
 * A pilot played solo, on its owner's shelf, has no Game and no Mediator, so
 * its owner runs Downtime alone. It lives on the pilot's solo seat
 * (`seats.downtime`), not in this module's table, and every function below is
 * the owner's (`writablePilot` with no Game). The rules are the Game's: the
 * same steps, clamped the same way, and upkeep paid once per Downtime, in the
 * Upkeep & Upgrade step, cleared only by a fresh Downtime. There is no
 * per-member completion: nobody else is at the table. Instead the seat keeps
 * which steps are done (`doneSteps`, `soloMarkStepDone`), so a step's Apply
 * runs once per Downtime: a reload cannot apply Train's +1 TP twice.
 */

const SOLO_ARGS = { pilotId: v.string() }

/** The running solo Downtime on a pilot's solo seat, or a refusal. */
async function runningSolo(
  ctx: MutationCtx,
  pilotId: string
): Promise<{ place: SeatPlace; downtime: NonNullable<Doc<'seats'>['downtime']> }> {
  const { place } = await writablePilot(ctx, null, pilotId)
  const downtime = (await readSeat(ctx, place, pilotId))?.downtime
  if (downtime === undefined) throw new ConvexError('Downtime is not running')
  return { place, downtime }
}

/**
 * A solo pilot's Downtime, in `state`'s shape (nobody on `completedBy`), for
 * its owner; null when the pilot is not on the caller's shelf, as `seats.solo`.
 */
export const soloState = query({
  args: SOLO_ARGS,
  returns: v.union(DOWNTIME_STATE, v.null()),
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    if ((await shelfRowOf(ctx, userId, 'pilots', args.pilotId)) === null) return null
    const downtime = (await readSeat(ctx, { ownerId: userId }, args.pilotId))?.downtime
    if (downtime === undefined) {
      return { running: false, stepIndex: null, completedBy: [], upkeepSpent: false }
    }
    return {
      running: true,
      stepIndex: downtime.stepIndex,
      startedAt: downtime.startedAt,
      completedBy: [],
      upkeepSpent: downtime.upkeepSpent,
      doneSteps: downtime.doneSteps ?? [],
    }
  },
})

/**
 * Begin a solo Downtime, at the first step with upkeep unpaid.
 *
 * Already running, it is a no-op rather than a restart: a second tab or a
 * second press must not clear `upkeepSpent` mid-Downtime and so charge the
 * upkeep twice. End it first to start over.
 */
export const soloBegin = mutation({
  args: SOLO_ARGS,
  handler: async (ctx, args): Promise<void> => {
    const { place } = await writablePilot(ctx, null, args.pilotId)
    if ((await readSeat(ctx, place, args.pilotId))?.downtime !== undefined) return
    await writeSeat(ctx, place, args.pilotId, () => ({
      downtime: { stepIndex: 0, startedAt: Date.now(), upkeepSpent: false, doneSteps: [] },
    }))
  },
})

/** Move a solo Downtime to its next step, stopping at the last. */
export const soloAdvance = mutation({
  args: SOLO_ARGS,
  handler: async (ctx, args): Promise<void> => {
    const { place, downtime } = await runningSolo(ctx, args.pilotId)
    const next = clampStep(downtime.stepIndex + 1)
    if (next === downtime.stepIndex) return
    await writeSeat(ctx, place, args.pilotId, () => ({
      downtime: { ...downtime, stepIndex: next },
    }))
  },
})

/**
 * Put a solo Downtime on a step, back or forward, held to the guide's steps.
 * It never touches upkeep: going back to Upkeep & Upgrade after paying does
 * not let it be paid again.
 */
export const soloSetStep = mutation({
  args: { ...SOLO_ARGS, stepIndex: v.number() },
  handler: async (ctx, args): Promise<void> => {
    const { place, downtime } = await runningSolo(ctx, args.pilotId)
    const stepIndex = clampStep(args.stepIndex)
    if (stepIndex === downtime.stepIndex) return
    await writeSeat(ctx, place, args.pilotId, () => ({ downtime: { ...downtime, stepIndex } }))
  },
})

/**
 * Record that this solo Downtime's crawler upkeep is paid. Only in the Upkeep
 * & Upgrade step, as the Game's `spendUpkeep`. Returns false when it was
 * already paid this Downtime, so the caller deducts the scrap only on true.
 */
export const soloSpendUpkeep = mutation({
  args: SOLO_ARGS,
  handler: async (ctx, args): Promise<boolean> => {
    const { place, downtime } = await runningSolo(ctx, args.pilotId)
    loadReferenceData()
    if (!isUpkeepStep(downtime.stepIndex)) {
      throw new ConvexError(`Upkeep is paid in the ${UPKEEP_STEP_NAME} step`)
    }
    if (downtime.upkeepSpent) return false
    await writeSeat(ctx, place, args.pilotId, () => ({
      downtime: { ...downtime, upkeepSpent: true },
    }))
    return true
  },
})

/**
 * Mark a step of this solo Downtime done: the step box claims it before it
 * applies the step (or as it skips it), as `soloSpendUpkeep` claims Upkeep.
 * Returns false when the step was already done this Downtime, so the caller
 * applies nothing a second time. Never undone: only a fresh Downtime
 * (`soloBegin`) clears it.
 */
export const soloMarkStepDone = mutation({
  args: { ...SOLO_ARGS, stepIndex: v.number() },
  handler: async (ctx, args): Promise<boolean> => {
    const { place, downtime } = await runningSolo(ctx, args.pilotId)
    if (!Number.isInteger(args.stepIndex) || clampStep(args.stepIndex) !== args.stepIndex) {
      throw new ConvexError('That is not a Downtime step')
    }
    const done = downtime.doneSteps ?? []
    if (done.includes(args.stepIndex)) return false
    await writeSeat(ctx, place, args.pilotId, () => ({
      downtime: { ...downtime, doneSteps: [...done, args.stepIndex] },
    }))
    return true
  },
})

/** End a solo Downtime. Not running is not an error. */
export const soloEnd = mutation({
  args: SOLO_ARGS,
  handler: async (ctx, args): Promise<void> => {
    const { place } = await writablePilot(ctx, null, args.pilotId)
    if ((await readSeat(ctx, place, args.pilotId))?.downtime === undefined) return
    await writeSeat(ctx, place, args.pilotId, () => ({ downtime: undefined }))
  },
})
