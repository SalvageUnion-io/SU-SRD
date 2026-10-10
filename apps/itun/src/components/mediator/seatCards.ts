/**
 * The Mediator Dashboard's seat cards (docs/architecture/mediator-dashboard.md
 * Q5): one per claimed pilot in the Game, built from `crewLines()` verbatim so
 * the Mediator and the players' Crew tab give one answer (ADR-038 §4).
 *
 * The order is stable — the owner's membership `joinedAt`, then callsign — and
 * never follows the numbers: a card that moves mid-fight is a card you lose.
 *
 * Pure: the Dashboard reads `crew.vitals`, `seats.forGame` and `games.members`
 * and hands them in.
 */

import type { BoardSources } from '../dashboard/boardMenu'
import type { CrewLine, CrewVitals } from '../dashboard/useGameFeed'
import { crewLines } from '../dashboard/useGameFeed'

/** A seat card: the crew line, plus what the Mediator does with it. */
export type SeatCard = CrewLine & {
  /** The pilot's Convex row id: the proposal target a tap selects. */
  rowId: string
  /** "Fine", or the first problem with "+N" when there are more. */
  status: string
  /** The whole line, for the card's accessible name. */
  label: string
}

type Member = { userId: string; joinedAt: number }

/** What draws the outline, in words, or null for "Fine" (as `CrewTab` reads it). */
function problemsOf(line: CrewLine): string[] {
  if (line.problems.length > 0) return line.problems
  if (line.mechAttention && line.mech) return [line.mech]
  return []
}

/** "HP 8/10" read aloud: "HP 8 of 10". */
function spoken(text: string): string {
  return text.replace(/(\d+)\/(\d+)/g, '$1 of $2')
}

export function tableSeats(
  crew: CrewVitals | null,
  seats: BoardSources['seats'],
  members: readonly Member[]
): SeatCard[] {
  if (crew === null) return []
  const joined = new Map(members.map((m) => [m.userId, m.joinedAt]))
  const rows = new Map(crew.pilots.map((p) => [p.linkId, p]))

  const cards: Array<SeatCard & { joinedAt: number }> = []
  // No pilot is "self" here: the Mediator reads the whole table alike.
  for (const line of crewLines(crew, seats, '')) {
    const row = rows.get(line.pilotId)
    if (row === undefined || row.ownerId === null) continue
    const problems = problemsOf(line)
    const status =
      problems.length === 0
        ? 'Fine'
        : `${problems[0]}${problems.length > 1 ? ` +${problems.length - 1}` : ''}`
    const label = [
      line.name,
      spoken(`HP ${line.hp}`),
      spoken(`AP ${line.ap}`),
      spoken(line.unit.replace(' · ', ', ')),
      problems.length === 0 ? 'fine' : `needs attention: ${problems.join(', ').toLowerCase()}`,
    ].join(', ')
    cards.push({
      ...line,
      rowId: row._id,
      status,
      label,
      joinedAt: joined.get(row.ownerId) ?? Number.POSITIVE_INFINITY,
    })
  }

  return cards
    .sort((a, b) => a.joinedAt - b.joinedAt || a.name.localeCompare(b.name))
    .map(({ joinedAt: _joinedAt, ...card }) => card)
}

/** "5 seats · 2 need attention", for the rail. */
export function seatSummary(cards: readonly SeatCard[]): string {
  const attention = cards.filter((c) => c.attention).length
  const seats = `${cards.length} ${cards.length === 1 ? 'seat' : 'seats'}`
  if (attention === 0) return `${seats} · all fine`
  return `${seats} · ${attention} ${attention === 1 ? 'needs' : 'need'} attention`
}
