/**
 * The Mediator's table as Play reads it (play.md §10), pure: no React and no
 * I/O. One seat per claimed pilot, from the server's crew read
 * (`crew.vitals`), the seats (`seats.forGame`, what each is resolving) and the
 * Game's members (the order they joined: a seat that moves mid-fight is a seat
 * you lose).
 *
 * It builds on the two crew readings already shared by every screen at the
 * table, so the Mediator and the players give one answer: `tableSeats()` (the
 * seats' order, the proposal target, the problems)
 * and `crewSeatLines()` (Play's Crew list: presence and the vital that needs
 * looking at). On top of those it lists every live vital.
 */

import { resolveGauge } from 'salvageunion-reference/rules'
import type { BoardSources } from '../boardMenu.model'
import { crewSeatLines } from '../crew.model'
import type { CrewVitals } from '../useGameFeed'
import { crewPool } from '../useGameFeed'
import { tableSeats } from './seatCards.model'

/** One vital chip on a seat: `HP | 7/10`, or a word (`▲ Ejected`) with no value. */
type SeatVital = {
  label: string
  value: string | null
  /** The ▲ and the bad state: the vital `crewLines()` says needs looking at. */
  attention: boolean
}

/** One seat at the table, as the Mediator's left column draws it. */
export type MediatorSeat = {
  /** The pilot's link id (`/sheet/pilot/<id>`). */
  pilotId: string
  /** The pilot's Convex row id: what a tap aims Propose at. */
  rowId: string
  /** The player's account: whether they are done with the Downtime step. */
  ownerId: string | null
  name: string
  /** Their seat beat within `PRESENCE_STALE_MS`. */
  present: boolean
  /** "Boarded · Buzzard", or "On foot". */
  mount: string
  /** The mech assigned to them, as the seat's mount Mini reads it; null with none. */
  mech: { name: string; sp: string; boarded: boolean } | null
  /** Every live vital: HP and AP, and aboard the mech's SP, EP and Heat. */
  vitals: SeatVital[]
  /** The ▲ and the red ring: something needs the Mediator. */
  attention: boolean
  /** What needs looking at, in words, or null. */
  problem: string | null
  /** What they are resolving now, in words, or null. */
  resolving: string | null
  /** The whole line, for the seat's accessible name. */
  label: string
}

type Member = { userId: string; joinedAt: number }
type CrewPilot = CrewVitals['pilots'][number]
type CrewMech = CrewVitals['mechs'][number]

/** Heat: a gauge that starts empty. */
function gauge(current: number | null, max: number | null): string {
  if (max === null) return current === null ? '0' : String(current)
  return `${resolveGauge(current ?? undefined, max)}/${max}`
}

/** Every live vital of a seat, the one `crewLines()` flags marked. */
function seatVitals(
  pilot: CrewPilot,
  mech: CrewMech | undefined,
  flagged: { label: string; attention: boolean }
): SeatVital[] {
  const vitals: SeatVital[] = [
    { label: 'HP', value: crewPool(pilot.currentHP, pilot.maxHP), attention: false },
    { label: 'AP', value: crewPool(pilot.currentAP, pilot.maxAP), attention: false },
  ]
  if (pilot.boarded && mech !== undefined) {
    vitals.push(
      { label: 'SP', value: crewPool(mech.currentSP, mech.maxSP), attention: false },
      { label: 'EP', value: crewPool(mech.currentEP, mech.maxEP), attention: false },
      { label: 'Heat', value: gauge(mech.currentHeat, mech.maxHeat), attention: false }
    )
  }
  if (!flagged.attention) return vitals
  const match = vitals.find((v) => v.label === flagged.label)
  if (match !== undefined) {
    match.attention = true
    return vitals
  }
  // A word, not a number ("Ejected", "Shut down"): its own chip.
  return [...vitals, { label: flagged.label, value: null, attention: true }]
}

/** The table's seats, in the order their players joined, each with every live vital. */
export function mediatorSeats(
  crew: CrewVitals | null,
  seats: BoardSources['seats'],
  members: readonly Member[],
  now: number
): MediatorSeat[] {
  if (crew === null) return []
  const lines = new Map(crewSeatLines(crew, seats, null, now).map((l) => [l.pilotId, l]))
  const pilots = new Map<string, CrewPilot>()
  for (const p of crew.pilots) if (p.linkId !== null) pilots.set(p.linkId, p)
  const mechs = new Map<string, CrewMech>()
  for (const m of crew.mechs) if (m.linkId !== null) mechs.set(m.linkId, m)

  return tableSeats(crew, seats, members).flatMap((card): MediatorSeat[] => {
    const pilot = pilots.get(card.pilotId)
    const line = lines.get(card.pilotId)
    if (pilot === undefined || line === undefined) return []
    const mech = pilot.mechId === null ? undefined : mechs.get(pilot.mechId)
    const problem = card.status === 'Fine' ? null : card.status
    return [
      {
        pilotId: card.pilotId,
        rowId: card.rowId,
        ownerId: pilot.ownerId,
        name: card.name,
        present: line.present,
        mount: line.mount,
        mech: card.unitMech,
        vitals: seatVitals(pilot, mech, line.vital),
        attention: card.attention,
        problem,
        resolving: card.resolving,
        // The seat card's line ("Bonesaw, HP 8 of 10, …") with whether they are here.
        label: [card.name, line.present ? 'here' : 'away', card.label.slice(card.name.length + 2)]
          .filter((part) => part !== '')
          .join(', '),
      },
    ]
  })
}

/** "3 of 4 here": how many seats are here, of how many. */
export function hereOf(seats: readonly Pick<MediatorSeat, 'present'>[]): {
  here: number
  of: number
} {
  return { here: seats.filter((s) => s.present).length, of: seats.length }
}

/** Whether a seat's player has marked the current Downtime step done. */
export function seatDone(
  seat: Pick<MediatorSeat, 'ownerId'>,
  completedBy: readonly { userId: string }[]
): boolean {
  return seat.ownerId !== null && completedBy.some((m) => m.userId === seat.ownerId)
}

/** A seat's Downtime line: "Step 3 · done ✓", "Step 3 · working", or away. */
export function seatStepLine(stepIndex: number, done: boolean, present: boolean): string {
  if (done) return `Step ${stepIndex + 1} · done ✓`
  return present ? `Step ${stepIndex + 1} · working` : `Step ${stepIndex + 1} · away`
}

/** How many seats are done with the step: the step box's "2 of 4 done". */
export function doneOf(
  seats: readonly Pick<MediatorSeat, 'ownerId'>[],
  completedBy: readonly { userId: string }[]
): { done: number; of: number } {
  return { done: seats.filter((s) => seatDone(s, completedBy)).length, of: seats.length }
}

/** The bar's Downtime option: "Begin Downtime", or running, "Downtime · Step 3". */
export function downtimeOptionLabel(running: boolean, stepIndex: number | null): string {
  return running ? `Downtime · Step ${(stepIndex ?? 0) + 1}` : 'Begin Downtime'
}
