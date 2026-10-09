/**
 * Type guards over reference data.
 *
 * Every guard here has at least one non-test consumer. There is no shape guard
 * for a System versus a Module: they share one schema, and the only field that
 * distinguishes them is the `schemaName` stamped at load time, so the
 * discriminant is `entity.schemaName === 'systems'`.
 *
 * The package barrel (`lib/index.ts`) re-exports, by name, only what consumers import.
 */

import type {
  SURefAbility,
  SURefClass,
  SURefEntity,
  SURefKeyword,
  SURefMetaEntity,
  SURefObjectAdvancedClass,
} from './schemas/index.js'

// ============================================================================
// TYPE GUARDS - Data shape
// ============================================================================

/**
 * Type guard to distinguish SURefEntity (structured data with id/name/source/page)
 * from SURefMetaAction or other object types (which lack these fields)
 * @param data - Entity, action, or other object to check
 * @returns True if the data has id, name, source, and page fields
 */

export function isEntityData<T extends object>(
  data: T
): data is T & SURefEntity & { id: string; name: string; source: string; page: number } {
  return 'id' in data && 'name' in data && 'source' in data && 'page' in data
}

// ============================================================================
// TYPE GUARDS - Schema-specific
// ============================================================================

/**
 * Type guard to check if an entity is an Ability
 * @param entity - The entity to check (null/undefined accepted; both return false)
 * @returns True if the entity is an Ability
 */

export function isAbility(entity: SURefMetaEntity | null | undefined): entity is SURefAbility {
  return entity !== null && typeof entity === 'object' && 'tree' in entity && 'level' in entity
}

/**
 * Type guard to check if an entity is a Keyword
 * @param entity - The entity to check
 * @returns True if the entity is a Keyword
 */

export function isKeyword(entity: SURefMetaEntity): entity is SURefKeyword {
  return 'id' in entity && 'name' in entity && 'source' in entity && 'page' in entity
}

/**
 * Type guard to check if an entity is a Core Class
 * @param entity - The entity to check
 * @returns True if the entity is a Core Class
 */

export function isCoreClass(
  entity: SURefMetaEntity
): entity is SURefClass & { coreTrees: string[] } {
  // Not `maxAbilities` or `advanceable`: hybrid records carry them too.
  // `coreTrees` and the explicit `hybrid` flag are what separate the branches.
  return (
    entity !== null &&
    typeof entity === 'object' &&
    'coreTrees' in entity &&
    'hybrid' in entity &&
    entity.hybrid === false
  )
}

/**
 * Type guard to check if an entity is an Advanced/Hybrid Class
 * @param entity - The entity to check
 * @returns True if the entity is an Advanced/Hybrid Class
 */

export function isBaseAdvancedClass(entity: SURefMetaEntity): entity is SURefObjectAdvancedClass {
  // Every class record carries the `hybrid` flag; it is what excludes a hybrid.
  return (
    entity !== null &&
    typeof entity === 'object' &&
    'advancedTree' in entity &&
    'hybrid' in entity &&
    entity.hybrid === true
  )
}
