/**
 * The Mediator's table as Play reads it (play.md §10), pure: no React and no
 * I/O. One seat per claimed pilot, from the server's crew read
 * (`crew.vitals`), the seats (`seats.forGame`, what each is resolving) and the
 * Game's members (the order they joined: a seat that moves mid-fight is a seat
 * you lose).
 *
 * It builds on the crew reading every screen at the table shares,
 * `crewSeatLines()` (presence, the vital that needs looking at, `problemsOf`),
 * so the Mediator and the players give one answer. On top of it each seat
 * carries what the Mediator does with it: the pilot row a tap aims Propose
 * at, every live vital, and the whole line read aloud. The order is stable,
 * the owner's membership `joinedAt` then the name, and never follows the
 * numbers. An unclaimed pilot (a pre-gen) is an open seat on the Game page,
 * not a seat here.
 */

import type { BoardSources } from '../boardMenu.model'
import { crewSeatLines, problemsOf } from '../crew.model'
import type { CrewVitals } from '../useGameFeed'
import { vitalText } from '../useGameFeed'

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
  mech: { id: string; name: string; sp: string; boarded: boolean } | null
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

/** Every live vital of a seat, the one `crewLines()` flags marked. */
function seatVitals(
  pilot: CrewPilot,
  mech: CrewMech | undefined,
  flagged: { label: string; attention: boolean }
): SeatVital[] {
  const vitals: SeatVital[] = [
    { label: 'HP', value: vitalText('pool', pilot.currentHP, pilot.maxHP), attention: false },
    { label: 'AP', value: vitalText('pool', pilot.currentAP, pilot.maxAP), attention: false },
  ]
  if (pilot.boarded && mech !== undefined) {
    vitals.push(
      { label: 'SP', value: vitalText('pool', mech.currentSP, mech.maxSP), attention: false },
      { label: 'EP', value: vitalText('pool', mech.currentEP, mech.maxEP), attention: false },
      { label: 'Heat', value: vitalText('gauge', mech.currentHeat, mech.maxHeat), attention: false }
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
/** "HP 8/10" read aloud: "HP 8 of 10". */
function spoken(text: string): string {
  return text.replace(/(\d+)\/(\d+)/g, '$1 of $2')
}

export function mediatorSeats(
  crew: CrewVitals | null,
  seats: BoardSources['seats'],
  members: readonly Member[],
  now: number
): MediatorSeat[] {
  if (crew === null) return []
  const joined = new Map(members.map((m) => [m.userId, m.joinedAt]))
  const pilots = new Map<string, CrewPilot>()
  for (const p of crew.pilots) if (p.linkId !== null) pilots.set(p.linkId, p)
  const mechs = new Map<string, CrewMech>()
  for (const m of crew.mechs) if (m.linkId !== null) mechs.set(m.linkId, m)

  // No pilot is "self" here: the Mediator reads the whole table alike.
  const seated = crewSeatLines(crew, seats, null, now).flatMap((line) => {
    const pilot = pilots.get(line.pilotId)
    if (pilot === undefined || pilot.ownerId === null) return []
    const mech = pilot.mechId === null ? undefined : mechs.get(pilot.mechId)
    const problems = problemsOf(line)
    const seat: MediatorSeat = {
      pilotId: line.pilotId,
      rowId: pilot._id,
      ownerId: pilot.ownerId,
      name: line.name,
      present: line.present,
      mount: line.mount,
      mech: line.unitMech,
      vitals: seatVitals(pilot, mech, line.vital),
      attention: line.attention,
      // The first problem, and how many more.
      problem:
        problems.length === 0
          ? null
          : `${problems[0]}${problems.length > 1 ? ` +${problems.length - 1}` : ''}`,
      resolving: line.resolving,
      label: [
        line.name,
        line.present ? 'here' : 'away',
        spoken(`HP ${line.hp}`),
        spoken(`AP ${line.ap}`),
        spoken(line.unit.replace(' · ', ', ')),
        problems.length === 0 ? 'fine' : `needs attention: ${problems.join(', ').toLowerCase()}`,
      ].join(', '),
    }
    return [{ seat, joinedAt: joined.get(pilot.ownerId) ?? Number.POSITIVE_INFINITY }]
  })
  return seated
    .sort((a, b) => a.joinedAt - b.joinedAt || a.seat.name.localeCompare(b.seat.name))
    .map(({ seat }) => seat)
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
