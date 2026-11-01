/**
 * An encounter's threat read and spoils (ADR-059 §5), pure apart from the
 * reference lookups. The read is `game-domain/rules/threat`'s, each
 * opponent's Tech Level read from its reference entity here.
 *
 * The spoils are what the opposition could leave behind: each Mech's Chassis,
 * Systems and Modules, its "loot table" (p.269), and each Vehicle or Drone's
 * Salvage Value in Scrap (p.246): Play's wreck rule (`wreckOf`), so Prep
 * promises what Play pays. Read-only: nothing here pays out.
 */

import type { Crew, ThreatRead } from 'game-domain/rules/threat'
import { threatRead } from 'game-domain/rules/threat'
import { wreckOf } from 'game-domain/rules/wreck'
import type { Encounter, EncounterOpponent } from 'game-domain/schemas/encounter'
import type { RefEntity } from 'salvageunion-reference'
import { opponentAsTray } from './encounter.model'

/** A reference entity's Tech Level, when it has one (Mechs and Vehicles do). */
function techLevelOf(entity: RefEntity | null): number | null {
  if (entity === null || !('techLevel' in entity)) return null
  return typeof entity.techLevel === 'number' ? entity.techLevel : null
}

function salvageValueOf(entity: RefEntity | null): number | null {
  if (entity === null || !('salvageValue' in entity)) return null
  return typeof entity.salvageValue === 'number' ? entity.salvageValue : null
}

/** The threat read of an encounter against a crew (`threatRead`, Core Book p.255). */
export function encounterThreat(encounter: Encounter, crew: Crew): ThreatRead {
  return threatRead(encounter, crew, (o) => techLevelOf(opponentAsTray(o).entity))
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
      techLevel: number
    }

const names = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((v) => (typeof v === 'object' && v !== null && 'name' in v ? v.name : null))
        .filter((n): n is string => typeof n === 'string')
    : []

/**
 * The spoils, opponent by opponent, in the order the opposition lists them:
 * a Mech as its Chassis and the loadout it was drawn with, a Vehicle or Drone
 * as its Salvage Value. Those that leave nothing (`wreckOf`) are left out.
 */
export function spoilsOf(encounter: Encounter): Spoil[] {
  return encounter.opposition.flatMap((opponent): Spoil[] => {
    const { entity, pattern } = opponentAsTray(opponent)
    if (opponent.refSchema === 'chassis' && entity !== null) {
      const salvageValue = salvageValueOf(entity)
      const techLevel = techLevelOf(entity)
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
    const wreck = wreckOf(opponent.refSchema, entity as Record<string, unknown> | null, [])
    if (wreck?.kind !== 'scrap') return []
    return [
      { kind: 'scrap', opponent, salvageValue: wreck.salvageValue, techLevel: wreck.techLevel },
    ]
  })
}
