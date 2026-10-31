import { downtimeStepOpId } from 'game-domain/ops/downtimeStep'
import {
  CRAFT_STEP_NAME,
  downtimeGuideSteps,
  downtimeStepCount,
  isUpkeepStep,
  UPKEEP_STEP_NAME,
} from 'game-domain/rules/downtime'
import type { GameStore } from './game/store'
import { RoomRefusal } from './refusal'

/**
 * A Downtime's rules: a Game's (`game/play.ts`)
 * or a solo pilot's (`account/soloPlay.ts`), each keeping its running state
 * where it keeps it (`DowntimePlace`). Who may act is the caller's to check.
 *
 * A step a pilot takes is an op with a stable id (`downtimeStepOpId`, named
 * by the run's `runId`; ADR-063 §6): applying it twice is a no-op, and
 * `doneSteps` reads the steps back off those ops.
 */

export type Running = {
  /** Names this Downtime, so its step ops are its own. */
  runId: string
  stepIndex: number
  startedAt: number
  /** The Game's members done with the step; always empty solo. */
  completedBy: string[]
  upkeepSpent: boolean
  /** The Craft step's Nanite processing was claimed (`spendNanites`). */
  nanitesSpent: boolean
}

/** Where a Downtime is kept: its running state, null when none runs, and the write that replaces it. */
export type DowntimePlace = {
  running(): Running | null
  write(next: Running | null): void
}

/**
 * Begin at the first step; true when this began one. Already running, a no-op
 * (false): a second press must not charge upkeep twice, nor count twice.
 */
export function beginDowntime(place: DowntimePlace, runId: string, at: number): boolean {
  if (place.running() !== null) return false
  place.write({
    runId,
    stepIndex: 0,
    startedAt: at,
    completedBy: [],
    upkeepSpent: false,
    nanitesSpent: false,
  })
  return true
}

/**
 * Put the Downtime on a step, held to the guide's: the next one, or any (the
 * Mediator's Back). A move clears who is done, and never re-opens upkeep.
 */
export function moveDowntime(place: DowntimePlace, next: (running: Running) => number): void {
  const running = requireRunning(place)
  const last = downtimeStepCount() - 1
  if (last < 0) throw new Error('The Crawler Downtime guide has no steps')
  const stepIndex = Math.max(0, Math.min(Math.trunc(next(running)), last))
  if (stepIndex === running.stepIndex) return
  place.write({ ...running, stepIndex, completedBy: [] })
}

/**
 * Record the crawler upkeep paid, in the Upkeep & Upgrade step only. False
 * when it was already paid, so the caller deducts the scrap once.
 */
export function spendUpkeep(place: DowntimePlace): boolean {
  const running = requireRunning(place)
  if (!isUpkeepStep(running.stepIndex)) {
    throw new RoomRefusal(`Upkeep is paid in the ${UPKEEP_STEP_NAME} step`)
  }
  if (running.upkeepSpent) return false
  place.write({ ...running, upkeepSpent: true })
  return true
}

/**
 * Record the crawler's Inert Meld Nanites processed, in the Craft step only.
 * False when they already were this Downtime, so the caller rolls them once.
 */
export function spendNanites(place: DowntimePlace): boolean {
  const running = requireRunning(place)
  if (downtimeGuideSteps()[running.stepIndex]?.name !== CRAFT_STEP_NAME) {
    throw new RoomRefusal(`Nanites are processed in the ${CRAFT_STEP_NAME} step`)
  }
  if (running.nanitesSpent) return false
  place.write({ ...running, nanitesSpent: true })
  return true
}

export function requireRunning(place: DowntimePlace): Running {
  const running = place.running()
  if (running === null) throw new RoomRefusal('Downtime is not running')
  return running
}

/** The steps `pilotId` has taken in the run `runId`: its step ops that landed. */
export function doneSteps(store: GameStore, runId: string, pilotId: string): number[] {
  const steps: number[] = []
  for (let step = 0; step < downtimeStepCount(); step++) {
    if (store.op(downtimeStepOpId(runId, pilotId, step))?.state === 'applied') steps.push(step)
  }
  return steps
}
