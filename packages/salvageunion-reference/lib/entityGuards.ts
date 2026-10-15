/**
 * Type guards over reference data.
 *
 * There is no shape guard for a System versus a Module: they share one schema,
 * and the only field that distinguishes them is the `schemaName` stamped at
 * load time, so the discriminant is `entity.schemaName === 'systems'`.
 *
 * The package barrel (`lib/index.ts`) re-exports, by name, only what consumers import.
 */

import type { RefAbility, RefClass, RefMetaEntity, RefObjectAdvancedClass } from './schemas/index'

// ============================================================================
// TYPE GUARDS - Schema-specific
// ============================================================================

/**
 * Type guard to check if an entity is an Ability
 * @param entity - The entity to check (null/undefined accepted; both return false)
 * @returns True if the entity is an Ability
 */

export function isAbility(entity: RefMetaEntity | null | undefined): entity is RefAbility {
  return entity !== null && typeof entity === 'object' && 'tree' in entity && 'level' in entity
}

/**
 * Type guard to check if an entity is a Core Class
 * @param entity - The entity to check
 * @returns True if the entity is a Core Class
 */

export function isCoreClass(entity: RefMetaEntity): entity is RefClass & { coreTrees: string[] } {
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

export function isBaseAdvancedClass(entity: RefMetaEntity): entity is RefObjectAdvancedClass {
  // Every class record carries the `hybrid` flag; it is what excludes a hybrid.
  return (
    entity !== null &&
    typeof entity === 'object' &&
    'advancedTree' in entity &&
    'hybrid' in entity &&
    entity.hybrid === true
  )
}
