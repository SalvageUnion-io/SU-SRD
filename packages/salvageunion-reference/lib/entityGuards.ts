/**
 * Type guards over reference data.
 *
 * Every guard here has at least one non-test consumer. Six more used to live
 * beside them — `isSystem`, `isModule`, `isSystemOrModule`, `isChassis`,
 * `isClass` and `hasTechLevel`, plus `hasTraits` — with no consumer anywhere in
 * the repo, and two of them (`isSystem` / `isModule`) were byte-identical
 * predicates that could not actually tell a System from a Module: Systems and
 * Modules share one schema, and the only field that distinguishes them is the
 * `schemaName` stamped at load time. They were deleted rather than fixed; the
 * discriminant to use if the need returns is `entity.schemaName === 'systems'`.
 *
 * Split out of the old `lib/utilities.ts` grab bag; still re-exported from
 * there (and from the package barrel), so this is an internal home, not a new
 * public surface.
 */

import type { SURefEntity, SURefMetaEntity } from './types/index.js'
import type {
  SURefAbility,
  SURefClass,
  SURefKeyword,
  SURefObjectAdvancedClass,
} from './types/index.js'

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
  return (
    entity !== null &&
    typeof entity === 'object' &&
    'maxAbilities' in entity &&
    'coreTrees' in entity &&
    'advanceable' in entity
  )
}

/**
 * Type guard to check if an entity is an Advanced Class
 * @param entity - The entity to check
 * @returns True if the entity is an Advanced Class
 */

export function isBaseAdvancedClass(entity: SURefMetaEntity): entity is SURefObjectAdvancedClass {
  return (
    entity !== null &&
    typeof entity === 'object' &&
    'advancedTree' in entity &&
    !('hybridTree' in entity)
  )
}
