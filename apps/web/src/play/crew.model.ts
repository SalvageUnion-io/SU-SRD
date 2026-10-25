/**
 * The Crew list's lines (play.md §7) and the Play bar's "N here", from the
 * server's crew read (`crew.vitals`): pure, no React and no I/O.
 *
 * One line per other seat in the Game: whether they are here (their player
 * has the Game open, `useGamePresence`), their callsign, their mount ("Boarded
 * · Atlas", "On foot") and one vital. Who needs looking at is `crewLines()`'s
 * verdict, the server's `attention`, so every screen at the table flags the
 * same crewmates; this only picks which number says it.
 */

import type { PairSide } from '../lib/units/crewPair'
import type { BoardSources } from './boardMenu.model'
import type { CrewLine, CrewVitals } from './useGameFeed'
import { crewLines, vitalCurrent } from './useGameFeed'

/**
 * What needs looking at, in words: the line's problems, else its parked mech's
 * line when that is what draws the outline. Play's Crew and the Mediator's
 * seats both read it.
 */
export function problemsOf(line: CrewLine): string[] {
  if (line.problems.length > 0) return line.problems
  if (line.mechAttention && line.mech) return [line.mech]
  return []
}

/** What is wrong, in words, or null for "Fine". */
function crewProblem(line: CrewLine): string | null {
  const problems = problemsOf(line)
  return problems.length === 0 ? null : problems.join(' · ')
}

/** The one vital a crew line shows: `SP 22`, `▲ HP 4`, or a word (`▲ Shut down`). */
type CrewVital = {
  label: string
  /** The number, current only; absent when the label says it all. */
  value: string | null
  /** The ▲ and the red frame: `crewLines()` says this crewmate needs looking at. */
  attention: boolean
}

/** One crewmate as the Crew list draws them: their crew line, and how the list reads it. */
export type CrewSeatLine = CrewLine & {
  /** Their player has the Game open. */
  present: boolean
  /** "Boarded · Atlas", or "On foot". */
  mount: string
  /** The mech they are aboard, or null on foot: the mount chip's value. */
  boardedIn: string | null
  vital: CrewVital
  /** What is wrong, in words, or null: the line's accessible name says it. */
  problem: string | null
}

type CrewPilot = CrewVitals['pilots'][number]
type CrewMech = CrewVitals['mechs'][number]

/**
 * The vital that says why a crewmate needs looking at, or, when nothing is
 * wrong, the one that matters most where they are: their mech's SP aboard,
 * their own HP on foot.
 */
function crewVital(pilot: CrewPilot, mech: CrewMech | undefined, attention: boolean): CrewVital {
  const hp = { label: 'HP', value: vitalCurrent('pool', pilot.currentHP, pilot.maxHP) }
  const sp =
    mech === undefined
      ? null
      : { label: 'SP', value: vitalCurrent('pool', mech.currentSP, mech.maxSP) }
  if (!attention) return { ...(pilot.boarded && sp !== null ? sp : hp), attention: false }

  const flag = (v: { label: string; value: string | null }): CrewVital => ({
    ...v,
    attention: true,
  })
  if (pilot.status.dead || pilot.status.injured) return flag(hp)
  if (pilot.status.ejected) return flag({ label: 'Ejected', value: null })
  const status = mech?.status ?? null
  if (mech !== undefined && status !== null) {
    if (status.destroyed)
      return flag({ label: 'SP', value: vitalCurrent('pool', mech.currentSP, mech.maxSP) })
    if (status.overheating)
      return flag({ label: 'Heat', value: vitalCurrent('gauge', mech.currentHeat, mech.maxHeat) })
    if (status.shutdown) return flag({ label: 'Shut down', value: null })
    if (sp !== null) return flag(sp)
  }
  return flag(hp)
}

/**
 * One line per crewmate but the pilot this screen plays (`selfPilotId`), in
 * the server's order, from `crew.vitals` and the seats (what each is
 * resolving). Empty until the crew read arrives.
 */
export function crewSeatLines(
  crew: CrewVitals | null,
  seats: BoardSources['seats'],
  selfPilotId: string | null,
  here: ReadonlySet<string> | null
): CrewSeatLine[] {
  if (crew === null) return []
  const mechs = new Map<string, CrewMech>()
  for (const m of crew.mechs) if (m.linkId !== null) mechs.set(m.linkId, m)
  const pilots = new Map<string, CrewPilot>()
  for (const p of crew.pilots) if (p.linkId !== null) pilots.set(p.linkId, p)

  return crewLines(crew, seats, selfPilotId).flatMap((line): CrewSeatLine[] => {
    const pilot = pilots.get(line.pilotId)
    if (line.self || pilot === undefined) return []
    const mech = pilot.mechId === null ? undefined : mechs.get(pilot.mechId)
    const boardedIn = pilot.boarded ? (mech?.name ?? 'a mech') : null
    return [
      {
        ...line,
        present: isHere(pilot, here),
        mount: boardedIn === null ? 'On foot' : `Boarded · ${boardedIn}`,
        boardedIn,
        vital: crewVital(pilot, mech, line.attention),
        problem: crewProblem(line),
      },
    ]
  })
}

/**
 * The mech side of a crewmate's pair (`crewPair`): the mech assigned to them,
 * or, aboard one the crew read does not list, that mech by name; null on foot
 * with none.
 */
export function pairedMech(line: CrewSeatLine): PairSide | null {
  if (line.unitMech !== null) return { id: line.unitMech.id, name: line.unitMech.name }
  return line.boardedIn === null ? null : { id: `${line.pilotId}:mech`, name: line.boardedIn }
}

/** The words a screen reader hears for one line, the whole of it in one go. */
export function crewLineLabel(line: CrewSeatLine): string {
  const vital =
    line.vital.value === null ? line.vital.label : `${line.vital.label} ${line.vital.value}`
  return [
    line.name,
    line.present ? 'here' : 'away',
    line.mount,
    line.problem ?? (line.vital.attention ? vital : `${vital}, fine`),
  ].join(', ')
}

/** A pilot is here when the member it is assigned to has the Game open. */
function isHere(pilot: { ownerId: string | null }, here: ReadonlySet<string> | null): boolean {
  return pilot.ownerId !== null && here?.has(pilot.ownerId) === true
}

/** How many seats in the Game are here now, the viewer's own included: the LIVE stamp's "N here". */
export function hereCount(
  pilots: readonly { ownerId: string | null }[] | undefined,
  here: ReadonlySet<string> | null
): number {
  return (pilots ?? []).filter((p) => isHere(p, here)).length
}
