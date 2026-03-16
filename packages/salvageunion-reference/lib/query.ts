/**
 * Query helper functions for filtering entities
 */

import { SalvageUnionReference, SchemaToModelMap } from './index.js'
import type { SURefEnumSchemaName } from './types/index.js'
import type { SchemaToEntityMap } from './index.js'

/**
 * Type guard to check if a string is a valid schema name
 *
 * @param name - String to check
 * @returns True if name is a valid schema name, with type narrowing
 *
 * @example
 * const name: string = 'equipment'
 * if (isValidSchemaName(name)) {
 *   // name is now narrowed to SURefEnumSchemaName
 *   const items = SalvageUnionReference.findAllIn(name, () => true)
 * }
 */
export function isValidSchemaName(name: string): name is SURefEnumSchemaName {
  return name in SchemaToModelMap
}

/**
 * Filter entities by tech level
 *
 * @param schemaName - The schema to search in
 * @param techLevel - The tech level to filter by
 * @returns Array of entities matching the tech level with schemaName attached
 *
 * @example
 * const level1Gear = filterByTechLevel('equipment', 1)
 * const level2Systems = filterByTechLevel('systems', 2)
 */
export function filterByTechLevel<T extends keyof SchemaToEntityMap>(
  schemaName: T,
  techLevel: number | string
): (SchemaToEntityMap[T] & { schemaName: T })[] {
  return SalvageUnionReference.findAllIn(schemaName, (entity: unknown) => {
    const ent = entity as Record<string, unknown>
    if ('techLevel' in ent) {
      return ent.techLevel === techLevel
    }
    return false
  }) as (SchemaToEntityMap[T] & { schemaName: T })[]
}

/**
 * Filter entities by source book
 *
 * @param schemaName - The schema to search in
 * @param source - The source book name to filter by
 * @returns Array of entities from the specified source with schemaName attached
 *
 * @example
 * const coreRulesEquipment = filterBySource('equipment', 'Salvage Union Workshop Manual')
 * const expansionSystems = filterBySource('systems', 'Mech Monday')
 */
export function filterBySource<T extends keyof SchemaToEntityMap>(
  schemaName: T,
  source: string
): (SchemaToEntityMap[T] & { schemaName: T })[] {
  return SalvageUnionReference.findAllIn(schemaName, (entity: unknown) => {
    const ent = entity as Record<string, unknown>
    if ('source' in ent) {
      return ent.source === source
    }
    return false
  }) as (SchemaToEntityMap[T] & { schemaName: T })[]
}
