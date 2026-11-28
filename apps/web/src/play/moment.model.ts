/**
 * The Moment (ADR-068): what the Main display holds, one beat at a time, and
 * what waits behind it. Pure, so the ladder is testable.
 *
 *  - **The ladder** (`momentOf`): the Stop Sign cuts in; then the beat you
 *    are in; then what the rules say you owe (a Heat Check); then Ready, your
 *    whole action list. Only your own tap and the Stop Sign replace a beat:
 *    what is owed while you are in one waits on the Next strip.
 *  - **The track** (`beatTrack`): an action's steps as its resolve has them
 *    (Activate, Roll, Push, Apply), each done, current or to come.
 *  - **The Table's Moment** (`tableBeat`, `tableTrack`): with no beat of your
 *    own, another seat's, from its Activate to its Apply, read-only.
 */

import type { SeatResolving } from 'game-domain/schemas/seat'
import type { ResolveModel } from './actionsDeck.model'

/** What can stand on the Main display, highest first. */
type Beat =
  | { kind: 'stop' }
  | { kind: 'action'; key: string }
  | { kind: 'owed'; key: string }
  | { kind: 'ready' }

/** The Main display's beat, and what waits for it on the Next strip. */
export type Moment = { beat: Beat; next: readonly Beat[] }

/**
 * The beat the Main display shows: Stop over everything, nothing lost under
 * it; the action you are in over what you owe; what you owe over Ready. What
 * the beat outranks waits on `next`, in the order it would rise.
 */
export function momentOf({
  stop,
  action,
  owed,
}: {
  /** The Stop Sign is up. */
  stop: boolean
  /** The key of the action the seat is resolving, on hand; null when none is. */
  action: string | null
  /** What the rules say this seat owes, in the order it falls due. */
  owed: readonly string[]
}): Moment {
  const waiting: Beat[] = [
    ...(action === null ? [] : [{ kind: 'action', key: action } as const]),
    ...owed.map((key) => ({ kind: 'owed', key }) as const),
  ]
  if (stop) return { beat: { kind: 'stop' }, next: waiting }
  const [first, ...rest] = waiting
  return first === undefined ? { beat: { kind: 'ready' }, next: [] } : { beat: first, next: rest }
}

/** A step of a beat: inked when done, underlined while it is the one to take. */
export type TrackStep = { key: StepKey; state: 'done' | 'on' | 'todo' }

type StepKey = 'activate' | 'roll' | 'push' | 'apply'

type Resolving = Extract<ResolveModel, { kind: 'resolve' }>

/**
 * An action's steps as its resolve runs them: Activate where its cost is paid
 * apart from its roll; Roll where it rolls; Push where a mech may push; Apply
 * where the roll writes something. The current step is the first not done.
 */
export function beatTrack(view: Resolving): TrackStep[] {
  const { controls, roll } = view
  const rolled = roll !== null && roll !== undefined
  const steps: { key: StepKey; done: boolean }[] = [
    ...(view.free || view.rollLeads || view.noRoll
      ? []
      : [{ key: 'activate' as const, done: controls.activated }]),
    ...(view.noRoll ? [] : [{ key: 'roll' as const, done: rolled }]),
    ...(controls.push === undefined
      ? []
      : [{ key: 'push' as const, done: controls.push.pushed || view.applied }]),
    ...(view.nothingToApply ? [] : [{ key: 'apply' as const, done: view.applied }]),
  ]
  // A Push is offered, never owed: once rolled, the next step is Apply's.
  const current = steps.find((step) => !step.done && !(step.key === 'push' && rolled))
  return steps.map((step) => ({
    key: step.key,
    state: step.done ? 'done' : step === current ? 'on' : 'todo',
  }))
}

/** Another seat's beat, as the table sees it (ADR-068 §3): whose it is, and how far it has got. */
export type TableBeat = {
  pilotId: string
  /** The pilot's name, as the crew reads it. */
  pilot: string
  boarded: boolean
  resolving: SeatResolving
}

/**
 * The Table's Moment: the first other seat with a beat in play, from its
 * Activate (or its roll) until its Apply, which is what the table may see of
 * it; null when no other seat has one. A seat the crew read does not name
 * yet waits for it.
 */
export function tableBeat(
  seats: readonly { pilotId: string; resolving?: SeatResolving | null }[],
  pilots: readonly { linkId: string | null; name: string; boarded: boolean }[],
  selfPilotId: string | null
): TableBeat | null {
  for (const seat of seats) {
    const resolving = seat.resolving ?? null
    if (seat.pilotId === selfPilotId || resolving === null || resolving.applied) continue
    if (!resolving.activated && resolving.roll === undefined && resolving.salvage === undefined)
      continue
    const pilot = pilots.find((p) => p.linkId === seat.pilotId)
    if (pilot === undefined) continue
    return { pilotId: seat.pilotId, pilot: pilot.name, boarded: pilot.boarded, resolving }
  }
  return null
}

/**
 * Another seat's steps, from what its seat says: Activate, Roll, Apply. Its
 * Push and whether it rolls at all stay on that screen, so the track holds
 * what the table can know.
 */
export function tableTrack(resolving: SeatResolving): TrackStep[] {
  const rolled = resolving.roll !== undefined || resolving.salvage !== undefined
  const steps: { key: StepKey; done: boolean }[] = [
    { key: 'activate', done: resolving.activated || rolled },
    { key: 'roll', done: rolled },
    { key: 'apply', done: resolving.applied },
  ]
  const current = steps.find((step) => !step.done)
  return steps.map((step) => ({
    key: step.key,
    state: step.done ? 'done' : step === current ? 'on' : 'todo',
  }))
}
