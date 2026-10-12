import type { SURefEntity, SURefMetaEntity, SURefObjectAnyPattern } from 'salvageunion-reference'
import {
  droneOwnLoadout,
  getChassisAbilities,
  isBioTitanPattern,
  nestedEntityGroups,
  patternGroups,
  resolveLoadout,
  SalvageUnionReference,
} from 'salvageunion-reference'

/** A labelled group of nested entities — rendered as a `Slab` separator + a
 * grid of depth+1 cards. */
export type { NestedGroup } from 'salvageunion-reference'

/**
 * Every NESTED reference entity a card surfaces, GROUPED for the body's
 * `Slab`-separated sections: Grants, chassis-ability Drones, and a crawler's
 * commander as an NPC. The entity model resolves them (`nestedEntityGroups`
 * in `salvageunion-reference`, `lib/view/parts/children.ts`).
 */
export const resolveNestedEntities = nestedEntityGroups

/**
 * A single pattern's loadout, grouped for the PATTERN view, MULTIPLICITY
 * PRESERVED — one card per installed copy (Leviathan's Destroyer shows six
 * .50 Cals). The entity model's (`patternGroups`).
 */
export const resolvePatternGroups = patternGroups

/** A drone plus its resolved systems/modules loadout — rendered as a compact
 * drone card with listing rows for its systems + modules. */
export type DroneLoadout = {
  drone: SURefEntity
  systems: SURefEntity[]
  modules: SURefEntity[]
  /**
   * The name this pattern gives THIS drone, when it differs from the stat
   * block's own name. Big Brother's DronTek pattern fields four Big Brother
   * Drones called Shield / Anti-Missile / Fire Support / Minelayer Drone, so
   * without this they would all render as four identical "Big Brother Drone"
   * cards. Absent when the config names the stat block directly.
   */
  instanceName?: string
}

/** The drone a CHASSIS controls — named by a chassis ability's `drone` field;
 * its systems/modules come from the drone entity's own loadout. */
export function resolveChassisDrone(entity: SURefMetaEntity): DroneLoadout | undefined {
  const abilities = getChassisAbilities(entity) ?? []
  const droneName = abilities
    .map((ability) => (ability as { drone?: unknown }).drone)
    .find((d): d is string => typeof d === 'string')
  if (!droneName) return undefined
  const drone = SalvageUnionReference.getByNameIn('drones', droneName)
  if (!drone) return undefined
  const droneSystems = Array.isArray(drone.systems) ? drone.systems : []
  const droneModules = Array.isArray(drone.modules) ? drone.modules : []
  return { drone, ...resolveLoadout(droneSystems, droneModules) }
}

/**
 * EVERY drone a PATTERN fields — each with its own name and loadout.
 *
 * Plural because patterns are: Little Sestra's three patterns ship one Sestra
 * Drone each, but Big Brother's DronTek pattern ships FOUR, so reading
 * `pattern.drones[0]` alone would drop three of them.
 *
 * A config's stat block is `ref ?? name` — `ref` is what lets an instance name
 * ("Shield Drone") sit over a shared stat block ("Big Brother Drone"). Configs
 * that resolve to nothing are skipped rather than failing the whole pattern.
 */
export function resolvePatternDrones(pattern: SURefObjectAnyPattern): DroneLoadout[] {
  if (isBioTitanPattern(pattern)) return []
  return (pattern.drones ?? []).flatMap((config) => {
    const statBlockName = config.ref ?? config.name
    const drone = SalvageUnionReference.getByNameIn('drones', statBlockName)
    if (!drone) return []
    return [
      {
        drone,
        ...resolveLoadout(config.systems ?? [], config.modules ?? []),
        ...(config.ref ? { instanceName: config.name } : {}),
      },
    ]
  })
}

/** A drone's OWN systems/modules loadout (from its `systems`/`modules` name
 * arrays) — used when a drone card renders standalone. The entity model's. */
export const resolveDroneOwnLoadout = droneOwnLoadout
