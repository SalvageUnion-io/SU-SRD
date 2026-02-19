import type {
  SURefChassis,
  SURefEntity,
  SURefEnumSchemaName,
  SURefMetaAction,
} from 'salvageunion-reference'
import { SalvageUnionReference, extractActions, getChassisAbilities } from 'salvageunion-reference'
import type { EntityRefRow } from '../types/common'

export type ComradeEntry = {
  entity: SURefEntity & { schemaName: SURefEnumSchemaName }
  /** Which entity granted this comrade (for display context) */
  sourceName: string
  /** Whether the comrade originates from pilot equipment/abilities or mech/chassis */
  sourceParent: 'pilot' | 'mech'
}

/** Returns true if an entity has mech-like stats (SP, EP, system/module slots). */
function hasStats(entity: SURefEntity): boolean {
  return 'structurePoints' in entity && typeof entity.structurePoints === 'number'
}

/**
 * Extract all comrades (drones/companions) granted by equipped entities.
 *
 * A comrade is any granted/assigned entity that has stats (SP, EP, slots, etc.),
 * excluding the mech itself.
 *
 * Detection methods:
 * 1. Action `drone` field — an action references a drone by name (e.g. chassis abilities)
 * 2. Stat-bearing equipment — equipment with structurePoints acts as a companion
 *    (e.g. Auto-Turret, Survey Drone, Mecha Companion)
 *
 * Sources checked:
 * - Pilot abilities & equipment (from pilotRefs)
 * - Mech systems & modules (from mechRefs)
 * - Chassis abilities (from mechChassis)
 */
export function extractComrades(
  pilotRefs: EntityRefRow[],
  mechRefs: EntityRefRow[],
  mechChassis?: SURefChassis
): ComradeEntry[] {
  const seen = new Set<string>()
  const comrades: ComradeEntry[] = []

  function addComrade(
    entity: SURefEntity & { schemaName: SURefEnumSchemaName },
    sourceName: string,
    sourceParent: 'pilot' | 'mech'
  ) {
    if (seen.has(entity.id)) return
    seen.add(entity.id)
    comrades.push({ entity, sourceName, sourceParent })
  }

  function collectDronesFromActions(
    actions: SURefMetaAction[] | undefined,
    sourceName: string,
    sourceParent: 'pilot' | 'mech'
  ) {
    if (!actions) return
    for (const action of actions) {
      if (!('drone' in action) || typeof action.drone !== 'string') continue
      const drone = SalvageUnionReference.findIn('drones', (d) => d.name === action.drone)
      if (drone) {
        addComrade(drone, sourceName, sourceParent)
      }
    }
  }

  function collectFromRef(ref: EntityRefRow, sourceParent: 'pilot' | 'mech') {
    const schemaName = ref.schema_name as SURefEnumSchemaName
    const entity = SalvageUnionReference.get(schemaName, ref.schema_ref_id)
    if (!entity) return

    // Check if the entity itself is a stat-bearing companion (e.g. Auto-Turret)
    if (schemaName === 'equipment' && hasStats(entity)) {
      addComrade(entity, entity.name, sourceParent)
    }

    // Check if any of its actions grant a drone
    collectDronesFromActions(extractActions(entity), entity.name, sourceParent)
  }

  // Check pilot entity refs (abilities, equipment)
  for (const ref of pilotRefs) {
    collectFromRef(ref, 'pilot')
  }

  // Check mech entity refs (systems, modules)
  for (const ref of mechRefs) {
    collectFromRef(ref, 'mech')
  }

  // Check chassis abilities
  if (mechChassis) {
    const chassisAbilities = getChassisAbilities(mechChassis)
    collectDronesFromActions(chassisAbilities, mechChassis.name, 'mech')
  }

  return comrades
}
