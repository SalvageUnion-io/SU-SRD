import type { DowntimeClaim } from 'game-domain/ops/downtimeStep'
import { downtimeClaimOpId, downtimeStepOpId } from 'game-domain/ops/downtimeStep'
import {
  CRAFT_STEP_NAME,
  currentDowntimeStep,
  downtimeGuideSteps,
  downtimeStepCount,
  isUpkeepStep,
  UPKEEP_STEP_NAME,
} from 'game-domain/rules/downtime'
import type { GameStore, UnitRow } from './game/store'
import type { GameUnits } from './game/units'
import { BatchRefused } from './game/units'
import type { OpInput } from './ops'
import { RoomRefusal } from './refusal'

/**
 * A Downtime's rules: a Game's (`game/play.ts`)
 * or a solo pilot's (`account/soloPlay.ts`), each keeping its running state
 * where it keeps it (`DowntimePlace`). Who may act is the caller's to check.
 *
 * A step a pilot takes is an op with a stable id (`downtimeStepOpId`, named
 * by the run's `runId`; ADR-063 §6): applying it twice is a no-op, and
 * `doneSteps` reads the steps back off those ops. The Upkeep and the Nanites
 * are crawler ops named the same way (`downtimeClaimOpId`), so `claimed`
 * reads them back too.
 */

export type Running = {
  /** Names this Downtime, so its step ops are its own. */
  runId: string
  stepIndex: number
  startedAt: number
  /** Claims a Downtime running at 4.5.33's deploy made under the old flags, before they were ops. */
  legacyClaims: DowntimeClaim[]
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
  place.write({ runId, stepIndex: 0, startedAt: at, legacyClaims: [] })
  return true
}

/**
 * Put the Downtime on a step, held to the guide's: the next one, or any (the
 * Mediator's Back). A move never re-opens upkeep.
 */
export function moveDowntime(place: DowntimePlace, next: (running: Running) => number): void {
  const running = requireRunning(place)
  const { index: stepIndex, count } = currentDowntimeStep(Math.trunc(next(running)))
  if (count === 0) throw new Error('The Crawler Downtime guide has no steps')
  if (stepIndex === running.stepIndex) return
  place.write({ ...running, stepIndex })
}

/** The step each claim is made in, and the words for one made outside it. */
const CLAIM_STEP: Record<
  DowntimeClaim,
  { inStep: (stepIndex: number) => boolean; refusal: string }
> = {
  upkeep: { inStep: isUpkeepStep, refusal: `Upkeep is paid in the ${UPKEEP_STEP_NAME} step` },
  nanites: {
    inStep: (stepIndex) => downtimeGuideSteps()[stepIndex]?.name === CRAFT_STEP_NAME,
    refusal: `Nanites are processed in the ${CRAFT_STEP_NAME} step`,
  },
}

/**
 * Pay the Upkeep or process the Nanites: in its own step, once per Downtime.
 * `op` is the crawler's change under the run's stable id (`downtimeClaimOpId`),
 * applied with the claim in one write, so a claim never stands without its
 * Scrap; a second press applies nothing. True when this call applied it.
 */
export function claimInStep(
  room: { store: GameStore; units: GameUnits; place: DowntimePlace },
  claim: DowntimeClaim,
  op: OpInput,
  author: string,
  crawler: UnitRow
): boolean {
  const { store, units, place } = room
  const running = requireRunning(place)
  const rule = CLAIM_STEP[claim]
  if (!rule.inStep(running.stepIndex)) throw new RoomRefusal(rule.refusal)
  if (op.id !== downtimeClaimOpId(running.runId, claim) || op.unitId !== crawler.id) {
    throw new RoomRefusal('That is not this Downtime’s crawler')
  }
  if (running.legacyClaims.includes(claim) || store.op(op.id) !== null) return false
  try {
    units.applyTo(crawler, op, author)
  } catch (error) {
    if (error instanceof BatchRefused) throw new RoomRefusal('The crawler could not take that')
    throw error
  }
  return true
}

/** Whether the running Downtime has made `claim`: its crawler op landed (or an old flag says so). */
export function claimed(store: GameStore, running: Running, claim: DowntimeClaim): boolean {
  if (running.legacyClaims.includes(claim)) return true
  return store.op(downtimeClaimOpId(running.runId, claim))?.state === 'applied'
}

function requireRunning(place: DowntimePlace): Running {
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
