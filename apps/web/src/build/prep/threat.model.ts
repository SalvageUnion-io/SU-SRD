/**
 * An encounter's threat read and spoils (ADR-059 §5), pure apart from the
 * reference lookups.
 *
 * The threat read is the inputs Core Book p.255 eyeballs a fight by, set
 * against a crew the Mediator picks: how many meet the Pilots (the outnumbered
 * side takes fewer actions), the Tech Levels they field, and their total SP
 * and HP. It stops there: the book says fights are not balanced, so there is
 * no difficulty score.
 *
 * The spoils are what the opposition could leave behind: each Mech's Chassis,
 * Systems and Modules, its "loot table" (p.269), and each Vehicle or Meld's
 * Salvage Value in Scrap (p.246). Read-only: nothing here pays out.
 */

import type { Encounter, EncounterOpponent } from 'game-domain/schemas/encounter'
import type { RefEntity } from 'salvageunion-reference'
import { opponentAsTray } from './encounter.model'

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

/** A reference entity's Tech Level, when it has one (Mechs and Vehicles do). */
function techLevelOf(entity: RefEntity | null): number | null {
  if (entity === null || !('techLevel' in entity)) return null
  return typeof entity.techLevel === 'number' ? entity.techLevel : null
}

function salvageValueOf(entity: RefEntity | null): number | null {
  if (entity === null || !('salvageValue' in entity)) return null
  return typeof entity.salvageValue === 'number' ? entity.salvageValue : null
}

/** Whether an opponent arrives with the encounter: alone, or in a wave 1 group. */
function arrivesFirst(encounter: Encounter, opponent: EncounterOpponent): boolean {
  if (opponent.groupId === undefined) return true
  return (encounter.groups ?? []).find((g) => g.id === opponent.groupId)?.wave === 1
}

/** The threat read of an encounter against a crew (Core Book p.255). */
export function threatRead(encounter: Encounter, crew: Crew): ThreatRead {
  const first = encounter.opposition.filter((o) => arrivesFirst(encounter, o)).length
  const levels = encounter.opposition
    .map((o) => techLevelOf(opponentAsTray(o).entity))
    .filter((tl): tl is number => tl !== null)
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

/** "Tech 2", or "Tech 1–3" for a spread. */
export function techSpread(levels: { low: number; high: number }): string {
  return levels.low === levels.high ? String(levels.low) : `${levels.low}–${levels.high}`
}

/** What one opponent could leave behind. */
export type Spoil =
  | {
      kind: 'mech'
      opponent: EncounterOpponent
      /** The Chassis's own Salvage Value, at its Tech Level. */
      chassis: { name: string; techLevel: number | null; salvageValue: number | null }
      systems: string[]
      modules: string[]
    }
  | {
      kind: 'scrap'
      opponent: EncounterOpponent
      salvageValue: number
      techLevel: number | null
    }

const names = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((v) => (typeof v === 'object' && v !== null && 'name' in v ? v.name : null))
        .filter((n): n is string => typeof n === 'string')
    : []

/**
 * The spoils, opponent by opponent, in the order the opposition lists them:
 * a Mech as its Chassis and the loadout it was drawn with, a Vehicle or Meld
 * as its Salvage Value. Those the data gives nothing to salvage are left out.
 */
export function spoilsOf(encounter: Encounter): Spoil[] {
  return encounter.opposition.flatMap((opponent): Spoil[] => {
    const { entity, pattern } = opponentAsTray(opponent)
    const salvageValue = salvageValueOf(entity)
    const techLevel = techLevelOf(entity)
    if (opponent.refSchema === 'chassis' && entity !== null) {
      return [
        {
          kind: 'mech',
          opponent,
          chassis: { name: entity.name, techLevel, salvageValue },
          systems: pattern !== null && 'systems' in pattern ? names(pattern.systems) : [],
          modules: pattern !== null && 'modules' in pattern ? names(pattern.modules) : [],
        },
      ]
    }
    if (salvageValue === null) return []
    return [{ kind: 'scrap', opponent, salvageValue, techLevel }]
  })
}
