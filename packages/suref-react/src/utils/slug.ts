/**
 * Utility functions for converting entity names to URL-safe slugs
 * and finding entities by their slug
 */

import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'

/**
 * Converts a name to a URL-safe slug
 * - Converts to lowercase
 * - Replaces spaces and special characters with hyphens
 * - Removes multiple consecutive hyphens
 * - Trims hyphens from start and end
 */
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters except word chars, spaces, and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}

/**
 * Finds an entity in a schema by its slug
 * Returns the entity if found, null otherwise
 */
export function findEntityBySlug(
  schemaName: SURefEnumSchemaName,
  slug: string
): SURefEntity | null {
  try {
    const entity = SalvageUnionReference.findIn(schemaName, (item) => {
      if (!('name' in item) || !item.name) {
        return false
      }
      const itemSlug = nameToSlug(item.name as string)
      return itemSlug === slug
    })
    return entity || null
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
    return nameToSlug(entity.name as string)
  }
  return entity.id
}
