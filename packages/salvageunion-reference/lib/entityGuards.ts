/**
 * Type guards over reference data, read off each record's shape so a consumer
 * branches on what an entity carries rather than on its schema's name.
 *
 * There is no shape guard for a System versus a Module (`isSystemOrModule`
 * covers both): they share one schema, and the only field that distinguishes
 * them is the `schemaName` stamped at load time, so the discriminant is
 * `entity.schemaName === 'systems'`. A Vehicle and a Drone are the same
 * mechanical stat block; `isVehicle` reads the stamp for the same reason.
 *
 * The package barrel (`lib/index.ts`) re-exports, by name, only what consumers import.
 */

import type {
  RefAbility,
  RefChassis,
  RefClass,
  RefCrawler,
  RefCrawlerBay,
  RefMetaEntity,
  RefModule,
  RefObjectAdvancedClass,
  RefSystem,
  RefVehicle,
} from './schemas/index'

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

/** A Chassis: the one schema with `chassisAbilities`, which every chassis states. */
export function isChassis(entity: RefMetaEntity): entity is RefChassis {
  return 'chassisAbilities' in entity
}

/** A Crawler type: its commander `npc` and its `actions`, both required. */
export function isCrawler(entity: RefMetaEntity): entity is RefCrawler {
  return 'npc' in entity && 'actions' in entity
}

/**
 * A Crawler Bay: a crew `npc`, a `damagedEffect` or the `expansion` tag (every
 * bay states it), and never `actions`, which is what separates its crew from a
 * crawler's commander.
 */
export function isCrawlerBay(entity: RefMetaEntity): entity is RefCrawlerBay {
  return (
    !('actions' in entity) &&
    ('expansion' in entity || 'npc' in entity || 'damagedEffect' in entity)
  )
}

/** A System or a Module: the two schemas that state `slotsRequired`. */
export function isSystemOrModule(entity: RefMetaEntity): entity is RefSystem | RefModule {
  return 'slotsRequired' in entity
}

/** A Vehicle. No field separates it from a Drone, so this reads the load-time stamp. */
export function isVehicle(entity: RefMetaEntity): entity is RefVehicle {
  return 'schemaName' in entity && entity.schemaName === 'vehicles'
}
