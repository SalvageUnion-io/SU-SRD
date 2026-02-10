/**
 * Hydrated entity types
 *
 * These types extend database rows with reference data from salvageunion-reference.
 * This allows direct access to entity properties without manual lookups.
 *
 * Example:
 *   entity.ref.name // Direct access to ability/equipment/system name
 *   entity.ref.description // Direct access to description
 */

import type { Tables } from './database-generated.types'
import type { SURefEntity } from 'salvageunion-reference'

/**
 * Entity with hydrated reference data and associated choices
 */
export type HydratedEntity = Tables<'suentities'> & {
  /**
   * Reference data from salvageunion-reference
   * Populated via SalvageUnionReference.get(schema_name, schema_ref_id)
   */
  ref: SURefEntity

  /**
   * Player choices associated with this entity
   * Populated from player_choices table
   */
  choices: Tables<'player_choices'>[]
  parentEntity?: HydratedEntity
}

/**
 * Cargo with optional hydrated reference data
 *
 * Cargo can be:
 * 1. Schema-based (has schema_name/schema_ref_id) - ref is populated
 * 2. Custom (no schema reference) - ref is undefined
 *
 * Position is stored in metadata.position, not as a separate field
 */
export type HydratedCargo = Tables<'cargo'> & {
  /**
   * Reference data from salvageunion-reference (if schema-based)
   * Populated via SalvageUnionReference.get(schema_name, schema_ref_id)
   * undefined for custom cargo items
   */
  ref?: SURefEntity
}

/**
 * Bay with hydrated reference data and typed metadata
 *
 * Bays are stored as suentities with schema_name='crawler-bays'
 * Metadata contains instance-specific state (damaged, NPC data)
 */
export type HydratedBay = Omit<HydratedEntity, 'metadata'> & {
  /**
   * Typed metadata for bay instance state
   */
  metadata: {
    damaged: boolean
    npc: {
      name: string
      notes: string
      hitPoints: number | null
      damage: number
    }
  } | null
}

/**
 * System with hydrated reference data and typed metadata
 *
 * Systems are stored as suentities with schema_name='systems'
 * Metadata contains instance-specific state (damaged)
 */
export type HydratedSystem = Omit<HydratedEntity, 'metadata'> & {
  /**
   * Typed metadata for system instance state
   */
  metadata: {
    damaged: boolean
  } | null
}

/**
 * Module with hydrated reference data and typed metadata
 *
 * Modules are stored as suentities with schema_name='modules'
 * Metadata contains instance-specific state (damaged)
 */
export type HydratedModule = Omit<HydratedEntity, 'metadata'> & {
  /**
   * Typed metadata for module instance state
   */
  metadata: {
    damaged: boolean
  } | null
}
