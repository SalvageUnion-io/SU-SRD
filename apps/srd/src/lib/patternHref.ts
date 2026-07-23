import { getEntitySlug, nameToSlug } from 'salvageunion-reference'
import type { SURefEntity, SURefObjectPattern } from 'salvageunion-reference'

/**
 * A chassis PATTERN's own page: `/schema/chassis/item/<chassis>/pattern/<pattern>/`.
 *
 * A pattern is a nested object on its chassis — no id, no `schemaName` — so it
 * cannot use `srdEntityHref`, and its URL is deliberately a SECOND segment
 * under the chassis it belongs to rather than a top-level `/schema/patterns/`
 * listing: patterns are not their own schema, and the route says so. Pattern
 * names are unique within a chassis, which is all this slug has to disambiguate.
 */
export function srdPatternHref(chassis: SURefEntity, pattern: SURefObjectPattern): string {
  return `/schema/chassis/item/${getEntitySlug(chassis)}/pattern/${nameToSlug(pattern.name)}/`
}
