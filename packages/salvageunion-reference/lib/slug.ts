/**
 * Utility functions for converting entity names to URL-safe slugs
 * and finding entities by their slug
 *
 * Note: This module avoids importing from helpers.ts to prevent circular dependencies.
 * It reaches the loaded BaseModel directly via ModelFactory for entity lookups.
 */

import { getLoadedModelBySchemaId } from './ModelFactory.js'
import type { SURefEntity, SURefEnumSchemaName } from './types/index.js'

export { nameToSlug } from './nameToSlug.js'

import { nameToSlug } from './nameToSlug.js'

/**
 * Finds an entity in a schema by its slug
 * Returns the entity if found, null otherwise
 *
 * O(1) via `BaseModel`'s slug index (built once per model, on first use).
 * Semantics are unchanged from the previous linear scan: rows without a
 * truthy string `name` are not slug-addressable, and on a slug collision the
 * FIRST row in data order wins — exactly what `Array.prototype.find` returned.
 */
export function findEntityBySlug(
  schemaName: SURefEnumSchemaName,
  slug: string
): SURefEntity | null {
  try {
    const model = getLoadedModelBySchemaId(schemaName)
    if (!model) return null
    return (model.getBySlug(slug) as SURefEntity | undefined) ?? null
  } catch {
    return null
  }
}

/**
 * Gets the slug for an entity
 * Returns the slug if the entity has a name, otherwise returns the ID
 */
export function getEntitySlug(entity: SURefEntity): string {
  if ('name' in entity && entity.name) {
    return nameToSlug(entity.name)
  }
  return entity.id
}
