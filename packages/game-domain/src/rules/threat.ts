/**
 * An encounter's threat read (ADR-059 §5): the inputs Core Book p.255 eyeballs
 * a fight by, set against a crew the Mediator picks. How many meet the Pilots
 * (the outnumbered side takes fewer actions), the Tech Levels they field, and
 * their total SP and HP. It stops there: the book says fights are not
 * balanced, so there is no difficulty score.
 *
 * Pure: an opponent's Tech Level is the caller's to read from its reference
 * entity (`techLevelOf`).
 */

import type { Encounter, EncounterOpponent } from '../schemas/encounter'

/** The crew a threat read is set against, as the Mediator picks it. */
export type Crew = { size: number; techLevel: number }

export const CREW_DEFAULT: Crew = { size: 4, techLevel: 1 }
/** The steppers' bounds: a crew of one to eight, Tech 1 to 6. */
export const CREW_SIZE_MAX = 8
export const TECH_LEVEL_MAX = 6

export type ThreatRead = {
  /** Those who meet the Pilots when it starts: alone, or in a wave 1 group. */
  first: number
  /** Those in groups held back to a later wave. */
  heldBack: number
  /** The lowest and highest Tech Level fielded, or null when none has one. */
  techLevels: { low: number; high: number } | null
  sp: number
  hp: number
  /** Which side is outnumbered when it starts, or null when even. */
  outnumbered: 'crew' | 'opposition' | null
  /** Where the opposition's Tech Levels sit against the crew's, or null when level or unknown. */
  tech: 'higher' | 'lower' | null
}

/** Whether an opponent arrives with the encounter: alone, or in a wave 1 group. */
function arrivesFirst(encounter: Encounter, opponent: EncounterOpponent): boolean {
  if (opponent.groupId === undefined) return true
  return (encounter.groups ?? []).find((g) => g.id === opponent.groupId)?.wave === 1
}

/** The threat read of an encounter against a crew (Core Book p.255). */
export function threatRead(
  encounter: Encounter,
  crew: Crew,
  techLevelOf: (opponent: EncounterOpponent) => number | null
): ThreatRead {
  const first = encounter.opposition.filter((o) => arrivesFirst(encounter, o)).length
  const levels = encounter.opposition.map(techLevelOf).filter((tl): tl is number => tl !== null)
  const techLevels =
    levels.length === 0 ? null : { low: Math.min(...levels), high: Math.max(...levels) }
  const total = (kind: 'sp' | 'hp') =>
    encounter.opposition.filter((o) => o.statKind === kind).reduce((sum, o) => sum + o.maxHp, 0)
  return {
    first,
    heldBack: encounter.opposition.length - first,
    techLevels,
    sp: total('sp'),
    hp: total('hp'),
    outnumbered:
      first === 0 || first === crew.size ? null : first > crew.size ? 'crew' : 'opposition',
    tech:
      techLevels === null
        ? null
        : techLevels.high > crew.techLevel
          ? 'higher'
          : techLevels.high < crew.techLevel
            ? 'lower'
            : null,
  }
}
