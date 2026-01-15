/**
 * Hydration functions for entities and cargo
 *
 * These functions enrich database rows with reference data from salvageunion-reference.
 * Uses the new v1.50 direct lookup methods (get, getMany) for efficient batch operations.
 */

import {
  SalvageUnionReference,
  EntitySchemaNames,
  type SURefEntity,
  type SURefEnumSchemaName,
  type EntitySchemaName,
} from 'salvageunion-reference'
import type { Tables } from '../../types/database-generated.types'
import type { HydratedEntity, HydratedCargo } from '../../types/hydrated'
import { logger } from '../logger'

/**
 * Hydrate a single entity with reference data
 *
 * @param entity - Entity row from suentities table
 * @param choices - Associated player choices (optional, defaults to empty array)
 * @param parentEntity - Parent entity if this entity has a parent_entity_id (optional)
 * @returns Hydrated entity with ref data
 * @throws Error if reference data not found
 */
export function hydrateEntity(
  entity: Tables<'suentities'>,
  choices: Tables<'player_choices'>[] = [],
  parentEntity?: HydratedEntity
): HydratedEntity {
  // Only entity schemas are stored in the database, not meta schemas
  const schemaName = entity.schema_name as SURefEnumSchemaName
  const ref = EntitySchemaNames.has(schemaName as EntitySchemaName)
    ? (SalvageUnionReference.get(
        schemaName as EntitySchemaName,
        entity.schema_ref_id
      ) as SURefEntity)
    : undefined

  if (!ref) {
    throw new Error(`Reference not found: ${entity.schema_name}/${entity.schema_ref_id}`)
  }

  return {
    ...entity,
    ref,
    choices,
    parentEntity,
  }
}

/**
 * Hydrate multiple entities with reference data (batch operation)
 *
 * Uses SalvageUnionReference.getMany() for efficient batch lookups.
 * Handles parent entity relationships by hydrating parent entities first,
 * then associating them with child entities.
 *
 * @param entities - Entity rows from suentities table
 * @param choicesByEntityId - Map of entity ID to player choices
 * @returns Array of hydrated entities
 * @throws Error if any reference data not found
 */
export function hydrateEntities(
  entities: Tables<'suentities'>[],
  choicesByEntityId: Map<string, Tables<'player_choices'>[]> = new Map()
): HydratedEntity[] {
  const requests = entities.map((entity) => ({
    schemaName: entity.schema_name as SURefEnumSchemaName,
    id: entity.schema_ref_id,
  }))

  const refs = SalvageUnionReference.getMany(requests)

  const refsByKey = new Map<string, SURefEntity>()
  refs.forEach((ref, index) => {
    if (ref) {
      const request = requests[index]
      if (request) {
        // Only entity schemas are stored in the database, so ref is guaranteed to be SURefEntity
        refsByKey.set(`${request.schemaName}:${request.id}`, ref as SURefEntity)
      }
    }
  })

  const hydratedById = new Map<string, HydratedEntity>()
  entities.forEach((entity) => {
    const key = `${entity.schema_name}:${entity.schema_ref_id}`
    const ref = refsByKey.get(key)

    if (!ref) {
      throw new Error(`Reference not found: ${entity.schema_name}/${entity.schema_ref_id}`)
    }

    const choices = choicesByEntityId.get(entity.id) || []

    hydratedById.set(entity.id, {
      ...entity,
      ref,
      choices,
      parentEntity: undefined,
    })
  })

  entities.forEach((entity) => {
    if (entity.parent_entity_id) {
      const hydrated = hydratedById.get(entity.id)
      const parent = hydratedById.get(entity.parent_entity_id)

      if (hydrated && parent) {
        hydrated.parentEntity = parent
        logger.log(
          `Associated parent entity: ${parent.ref.name} (${parent.id}) -> ${hydrated.ref.name} (${hydrated.id})`
        )
      } else {
        logger.warn(
          `Parent entity not found for ${entity.schema_name}/${entity.schema_ref_id} (parent_entity_id: ${entity.parent_entity_id})`
        )
      }
    }
  })

  return entities.map((entity) => hydratedById.get(entity.id)!)
}

/**
 * Hydrate a single cargo item with optional reference data
 *
 * @param cargo - Cargo row from database
 * @returns Hydrated cargo with optional ref data (position is in metadata)
 */
export function hydrateCargo(cargo: Tables<'cargo'>): HydratedCargo {
  if (cargo.schema_name && cargo.schema_ref_id) {
    const ref = SalvageUnionReference.get(
      cargo.schema_name as SURefEnumSchemaName,
      cargo.schema_ref_id
    )

    if (!ref) {
      throw new Error(`Reference not found for cargo: ${cargo.schema_name}/${cargo.schema_ref_id}`)
    }

    return {
      ...cargo,
      ref,
    }
  }

  return {
    ...cargo,
    ref: undefined,
  }
}

/**
 * Hydrate multiple cargo items with optional reference data (batch operation)
 *
 * @param cargoItems - Cargo rows from database
 * @returns Array of hydrated cargo items
 */
export function hydrateCargoItems(cargoItems: Tables<'cargo'>[]): HydratedCargo[] {
  const schemaBased = cargoItems.filter((c) => c.schema_name && c.schema_ref_id)
  const custom = cargoItems.filter((c) => !c.schema_name || !c.schema_ref_id)

  const requests = schemaBased.map((cargo) => ({
    schemaName: cargo.schema_name as SURefEnumSchemaName,
    id: cargo.schema_ref_id!,
  }))

  const refs = SalvageUnionReference.getMany(requests)

  const refsByKey = new Map<string, SURefEntity>()
  refs.forEach((ref, index) => {
    if (ref) {
      const request = requests[index]
      if (request) {
        // Only entity schemas are stored in the database, so ref is guaranteed to be SURefEntity
        refsByKey.set(`${request.schemaName}:${request.id}`, ref as SURefEntity)
      }
    }
  })

  const hydratedSchemaBased: HydratedCargo[] = schemaBased.map((cargo) => {
    const key = `${cargo.schema_name}:${cargo.schema_ref_id}`
    const ref = refsByKey.get(key)

    if (!ref) {
      throw new Error(`Reference not found for cargo: ${cargo.schema_name}/${cargo.schema_ref_id}`)
    }

    return {
      ...cargo,
      ref,
    }
  })

  const hydratedCustom: HydratedCargo[] = custom.map((cargo) => ({
    ...cargo,
    ref: undefined,
  }))

  const result: HydratedCargo[] = []
  for (const cargo of cargoItems) {
    const hydrated =
      hydratedSchemaBased.find((h) => h.id === cargo.id) ||
      hydratedCustom.find((h) => h.id === cargo.id)

    if (hydrated) {
      result.push(hydrated)
    }
  }

  return result
}
