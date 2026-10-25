import { ConvexError, v } from 'convex/values'
import { downtimeStepOpId } from 'game-domain/ops/downtimeStep'
import { downtimeGuideSteps, isUpkeepStep, UPKEEP_STEP_NAME } from 'game-domain/rules/downtime'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { query } from './_generated/server'
import { displayNameOf } from './account'
import { mutation } from './model/entities'
import { membershipOrNull, requireMediator, requireMember, requireUser } from './model/permissions'
import { loadReferenceData } from './model/referenceData'
import { readSeat, writeSeat } from './model/seats'
import { bumpCount } from './model/usage'
import { shelfRowOf, writablePilot } from './seats'

/**
 * Downtime (ADR-030): a Game's, or a solo pilot's.
 *
 * Downtime is the one procedure in Salvage Union the whole crew performs **in
 * step**, which is why a Game's is Game state advanced by the Mediator rather
 * than something each player tracks alone: the Game's `downtime` row. A pilot
 * played solo, on its owner's shelf, has no Game and no Mediator, so its owner
 * runs its own, on its solo seat (`seats.downtime`).
 *
 * As in `seats.ts`, every function takes the place: `gameId`, or null with the
 * solo pilot's `pilotId`. The rules are the same at both, one body per verb
 * (`downtimeAt` resolves the place to its store); only who may act differs. In
 * a Game the Mediator begins, moves and ends it and pays Upkeep; solo, the
 * pilot's owner does (`writablePilot` with no Game). Either way whoever may
 * write a pilot takes its steps.
 *
 * ## Upkeep is spent once, not six times
 *
 * `upkeepSpent` is a flag on the *Game's* Downtime, not on each member. The
 * crawler is the crew's, so its upkeep is one cost paid once — six members
 * each spending it would charge it six times. The crawler is the Mediator's
 * (ADR-038 §5), so only the Mediator pays it, and the flag guards a second tab
 * or a second press. A solo Downtime pays its own once, the same way. The flag
 * resets when a new Downtime starts, never when a step advances, and beginning
 * one that is already running is a no-op, so a second press never clears it.
 *
 * Upkeep is a step of the procedure ("Upkeep & Upgrade", p.227), so Upkeep is
 * paid in that step and refused in every other. The crawler sheet is not
 * gated: it stays editable at any time.
 *
 * ## Completion is per step, not cumulative
 *
 * A Game's `completedBy` (`markStepDone`; solo, nobody else is at the table)
 * clears on every move. Keeping it would leave a player who finished step 1
 * looking finished for the whole Downtime, which tells the Mediator the
 * opposite of what they need to know.
 *
 * ## A step applies once per pilot
 *
 * What a step applies (Train's +1 TP, Restore) is one op on the pilot with a
 * stable id (`downtimeStepOpId`: the Downtime's start, the pilot, the step;
 * ADR-063 §6), sent through `ops.apply`, so a second send is a no-op. Skip
 * sends the same op with nothing in it. `state` reads which steps a pilot has
 * taken back off those ids. `completedBy` cannot do it: it is per member, it
 * clears on every move, and a player may untick it. A new Downtime has a new
 * start, so its steps apply afresh; Undo, the Mediator's Back and a reload
 * never let one apply twice.
 */

/**
 * `stepIndex` held to the guide's steps, 0 to the last; a Game's Downtime and
 * a solo one count steps the same way.
 */
function clampStep(stepIndex: number): number {
  loadReferenceData()
  const steps = downtimeGuideSteps()
  if (steps.length === 0) throw new Error('The Crawler Downtime guide has no steps')
  return Math.max(0, Math.min(Math.trunc(stepIndex), steps.length - 1))
}

/** A running Downtime, at either place. */
type Running = {
  stepIndex: number
  startedAt: number | null
  upkeepSpent: boolean
  /** The Game's members done with the step; always empty solo. */
  completedBy: Id<'users'>[]
}

/** A place's Downtime: its running state (null when none runs), and the write that replaces it. */
type DowntimeAt = {
  running: Running | null
  write: (next: Running | null) => Promise<void>
}

/** The Game's Downtime row, or null before its first Downtime. */
async function gameRow(
  ctx: QueryCtx | MutationCtx,
  gameId: Id<'games'>
): Promise<Doc<'downtime'> | null> {
  return await ctx.db
    .query('downtime')
    .withIndex('by_game', (q) => q.eq('gameId', gameId))
    .unique()
}

/** The row's Downtime; a row with no step is one that is not running. */
function gameRunning(row: Doc<'downtime'> | null): Running | null {
  if (row === null || row.stepIndex === null) return null
  return {
    stepIndex: row.stepIndex,
    startedAt: row.startedAt,
    upkeepSpent: row.upkeepSpent,
    completedBy: row.completedBy,
  }
}

/** A solo seat's Downtime. */
function soloRunning(seat: Doc<'seats'> | null): Running | null {
  const downtime = seat?.downtime
  if (downtime === undefined) return null
  return {
    stepIndex: downtime.stepIndex,
    startedAt: downtime.startedAt,
    upkeepSpent: downtime.upkeepSpent,
    completedBy: [],
  }
}

/** Where a Downtime is: a Game's (`gameId`), or a solo pilot's (`gameId` null and `pilotId`). */
const PLACE_ARGS = {
  gameId: v.union(v.id('games'), v.null()),
  /** The solo pilot; in a Game, the pilot whose `doneSteps` `state` reads. */
  pilotId: v.optional(v.string()),
}

type Place = { gameId: Id<'games'> | null; pilotId?: string }

/** The pilot a place names, or a refusal when it names none. */
function pilotOf(place: Place): string {
  if (place.pilotId === undefined) throw new ConvexError('A solo Downtime names its pilot')
  return place.pilotId
}

/**
 * The Downtime at `place`, once the caller may act on it: in a Game the
 * Mediator (`table`) or whoever may write `pilotId` (`pilot`); solo, the
 * pilot's owner either way.
 */
async function downtimeAt(
  ctx: MutationCtx,
  place: Place,
  who: 'table' | 'pilot'
): Promise<DowntimeAt> {
  const { gameId } = place
  if (gameId === null) {
    const pilotId = pilotOf(place)
    const { place: seat } = await writablePilot(ctx, null, pilotId)
    return {
      running: soloRunning(await readSeat(ctx, seat, pilotId)),
      write: async (next) => {
        await writeSeat(ctx, seat, pilotId, () => ({
          downtime:
            next === null
              ? undefined
              : {
                  stepIndex: next.stepIndex,
                  startedAt: next.startedAt ?? Date.now(),
                  upkeepSpent: next.upkeepSpent,
                },
        }))
      },
    }
  }
  if (who === 'table') await requireMediator(ctx, gameId)
  else await writablePilot(ctx, gameId, pilotOf(place))
  const row = await gameRow(ctx, gameId)
  return {
    running: gameRunning(row),
    write: async (next) => {
      const fields = next === null ? { stepIndex: null, startedAt: null, completedBy: [] } : next
      if (row !== null) await ctx.db.patch(row._id, fields)
      else await ctx.db.insert('downtime', { gameId, upkeepSpent: false, ...fields })
    },
  }
}

/**
 * The running Downtime at `place`, or a refusal when none is running. A state
 * refusal, not an authorization one, so a plain `ConvexError`.
 */
async function runningAt(
  ctx: MutationCtx,
  place: Place,
  who: 'table' | 'pilot' = 'table'
): Promise<{ running: Running; write: DowntimeAt['write'] }> {
  const { running, write } = await downtimeAt(ctx, place, who)
  if (running === null) throw new ConvexError('Downtime is not running')
  return { running, write }
}

/** A Downtime as `state` reports it. */
const DOWNTIME_STATE = v.object({
  running: v.boolean(),
  stepIndex: v.union(v.number(), v.null()),
  startedAt: v.union(v.number(), v.null()),
  completedBy: v.array(v.object({ userId: v.id('users'), displayName: v.string() })),
  upkeepSpent: v.boolean(),
  /** The steps `pilotId` has taken this Downtime (their step ops); empty with no pilot. */
  doneSteps: v.array(v.number()),
})

/** The steps a pilot has taken in the Downtime begun at `startedAt`: its step ops that landed. */
async function doneStepsOf(
  ctx: QueryCtx,
  startedAt: number | null,
  pilotId: string | undefined
): Promise<number[]> {
  if (pilotId === undefined) return []
  loadReferenceData()
  const done: number[] = []
  for (let step = 0; step < downtimeGuideSteps().length; step++) {
    const opId = downtimeStepOpId(startedAt ?? 0, pilotId, step)
    const op = await ctx.db
      .query('ops')
      .withIndex('by_op_id', (q) => q.eq('opId', opId))
      .first()
    if (op !== null) done.push(step)
  }
  return done
}

/**
 * The Downtime at a place: a Game's for its members, with who has finished the
 * step; a solo pilot's for its owner, null when the pilot is not on the
 * caller's shelf (as `seats.solo`). Not running is a state, reported as one.
 */
export const state = query({
  args: PLACE_ARGS,
  returns: v.union(DOWNTIME_STATE, v.null()),
  handler: async (ctx, args) => {
    let running: Running | null
    if (args.gameId === null) {
      const pilotId = pilotOf(args)
      const userId = await requireUser(ctx)
      if ((await shelfRowOf(ctx, userId, 'pilots', pilotId)) === null) return null
      running = soloRunning(await readSeat(ctx, { ownerId: userId }, pilotId))
    } else {
      if ((await membershipOrNull(ctx, args.gameId)) === null) return null
      running = gameRunning(await gameRow(ctx, args.gameId))
    }
    if (running === null) {
      return {
        running: false,
        stepIndex: null,
        startedAt: null,
        completedBy: [],
        upkeepSpent: false,
        doneSteps: [],
      }
    }

    const completedBy: Array<{ userId: Id<'users'>; displayName: string }> = []
    for (const userId of running.completedBy) {
      const user = await ctx.db.get(userId)
      completedBy.push({ userId, displayName: displayNameOf(user, 'Crewmate') })
    }
    return {
      running: true,
      stepIndex: running.stepIndex,
      startedAt: running.startedAt,
      completedBy,
      upkeepSpent: running.upkeepSpent,
      doneSteps: await doneStepsOf(ctx, running.startedAt, args.pilotId),
    }
  },
})

/**
 * Begin a Downtime, at the first step with upkeep unpaid.
 *
 * Already running, it is a no-op rather than a restart: a second tab or a
 * second press must not clear `upkeepSpent` mid-Downtime and so charge the
 * upkeep twice. End it first to start over.
 */
export const begin = mutation({
  args: PLACE_ARGS,
  handler: async (ctx, args): Promise<void> => {
    const { running, write } = await downtimeAt(ctx, args, 'table')
    if (running !== null) return
    await write({
      stepIndex: 0,
      startedAt: Date.now(),
      upkeepSpent: false,
      completedBy: [],
    })
    await bumpCount(ctx, args.gameId === null ? 'downtime:solo' : 'downtime:game')
  },
})

/** Move to the next step, stopping at the last. A move clears who is done (per step). */
export const advance = mutation({
  args: PLACE_ARGS,
  handler: async (ctx, args): Promise<void> => {
    const { running, write } = await runningAt(ctx, args)
    const next = clampStep(running.stepIndex + 1)
    if (next === running.stepIndex) return
    await write({ ...running, stepIndex: next, completedBy: [] })
  },
})

/**
 * Put the Downtime on a step, back or forward, held to the guide's steps: the
 * Mediator's Back (play.md §10), or solo any step. As `advance`, a move clears
 * who is done. It never touches upkeep: going back to Upkeep & Upgrade after
 * paying does not let it be paid again.
 */
export const setStep = mutation({
  args: { ...PLACE_ARGS, stepIndex: v.number() },
  handler: async (ctx, args): Promise<void> => {
    const { running, write } = await runningAt(ctx, args)
    const stepIndex = clampStep(args.stepIndex)
    if (stepIndex === running.stepIndex) return
    await write({ ...running, stepIndex, completedBy: [] })
  },
})

/** End the Downtime. Not running is not an error. */
export const end = mutation({
  args: PLACE_ARGS,
  handler: async (ctx, args): Promise<void> => {
    const { running, write } = await downtimeAt(ctx, args, 'table')
    if (running === null) return
    await write(null)
  },
})

/**
 * Mark yourself done with a Game's current step.
 *
 * Any member, for themselves only — a Mediator cannot tick a player off, which
 * would be the same overreach as writing their sheet. Idempotent, so a
 * double-tap does not add a duplicate. Solo there is nobody else to tell.
 */
export const markStepDone = mutation({
  args: { gameId: v.id('games'), done: v.boolean() },
  handler: async (ctx, args): Promise<void> => {
    const membership = await requireMember(ctx, args.gameId)
    const row = await gameRow(ctx, args.gameId)
    if (gameRunning(row) === null || row === null) {
      throw new ConvexError('Downtime is not running')
    }
    const without = row.completedBy.filter((id) => id !== membership.userId)
    await ctx.db.patch(row._id, {
      completedBy: args.done ? [...without, membership.userId] : without,
    })
  },
})

/**
 * Record that this Downtime's crawler upkeep is paid. In a Game the
 * Mediator's: the crawler is theirs (ADR-038 §5, `assertMayEditCrawler`).
 * Only in the Upkeep & Upgrade step: any other step refuses it (see the
 * module header).
 *
 * Returns false when it was already spent rather than throwing: a second press,
 * or the hub and Play open side by side, is an ordinary race, not an
 * error to show anybody. The caller uses the result to decide whether to also
 * deduct the scrap.
 */
export const spendUpkeep = mutation({
  args: PLACE_ARGS,
  handler: async (ctx, args): Promise<boolean> => {
    const { running, write } = await runningAt(ctx, args)
    loadReferenceData()
    if (!isUpkeepStep(running.stepIndex)) {
      throw new ConvexError(`Upkeep is paid in the ${UPKEEP_STEP_NAME} step`)
    }
    if (running.upkeepSpent) return false
    await write({ ...running, upkeepSpent: true })
    return true
  },
})
