/**
 * Utility functions for converting entity names to URL-safe slugs
 * and finding entities by their slug
 *
 * Note: This module avoids importing from helpers.ts to prevent circular dependencies.
 * It uses getDataMaps() from ModelFactory directly for entity lookups.
 */

import type { SURefEntity, SURefEnumSchemaName } from './types/index.js'
import { getDataMaps } from './ModelFactory.js'

/**
 * Defensive cap on input length before any regex processing in `nameToSlug`.
 * `nameToSlug` is exported public API — real entity names in `data/*.json` top
 * out at ~50 characters, so this is generous headroom, never expected to
 * truncate real data. It bounds worst-case regex work to a constant for any
 * caller (current or future) that passes untrusted/oversized input; it is
 * belt-and-suspenders alongside the quantifier fix below, not a substitute
 * for it (see CodeQL js/polynomial-redos note on `nameToSlug`).
 */
const MAX_SLUG_INPUT_LENGTH = 256

/**
 * Converts a name to a URL-safe slug
 * - Converts to lowercase
 * - Replaces spaces and special characters with hyphens
 * - Removes multiple consecutive hyphens
 * - Trims hyphens from start and end
 *
 * CodeQL js/polynomial-redos note: the trailing-hyphen-trim regex used to be
 * `/^-+|-+$/g`. The `-+$` branch has a quantifier immediately followed by an
 * anchor with nothing after it in the string to guarantee the match, which is
 * the classic superlinear (O(n^2)) backtracking shape for the query
 * (e.g. `"a" + "-".repeat(n) + "a"` forces a retry at every start position).
 * The fix collapses whitespace/hyphen runs into a single hyphen first
 * (`[\s-]+` — safe: nothing follows the quantifier, so no backtracking), which
 * guarantees at most one leading and one trailing hyphen remains. That lets
 * the final trim drop its quantifier entirely (`/^-|-$/g`), leaving no
 * superlinear regex in the function.
 */
export function nameToSlug(name: string): string {
  const input = name.length > MAX_SLUG_INPUT_LENGTH ? name.slice(0, MAX_SLUG_INPUT_LENGTH) : name
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters except word chars, spaces, and hyphens
    .replace(/[\s-]+/g, '-') // Collapse runs of whitespace and/or hyphens into a single hyphen
    .replace(/^-|-$/g, '') // Remove a leading/trailing hyphen (at most one remains after the collapse above)
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
    const { dataMap } = getDataMaps()
    const data = dataMap[schemaName] as SURefEntity[] | undefined
    if (!data) return null
    const entity = data.find((item) => {
      if (!('name' in item) || !item.name) {
        return false
      }
      const itemSlug = nameToSlug(item.name)
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
    return nameToSlug(entity.name)
  }
  return entity.id
}
