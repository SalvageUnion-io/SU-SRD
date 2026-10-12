import type { SURefEntity, SURefObjectAnyPattern } from 'salvageunion-reference'
import { getEntitySlug, isBioTitanPattern, nameToSlug } from 'salvageunion-reference'
import { patternHref } from './entityHref'

/**
 * A PATTERN's own page, under its host: `/schema/chassis/item/<chassis>/pattern/<pattern>/`
 * for a mech pattern, `/schema/bio-titans/item/<bio-titan>/pattern/<pattern>/`
 * for a Bio-Titan's.
 *
 * A pattern is a nested object on its host — no id, no `schemaName` — so it
 * cannot use `srdEntityHref`, and its URL is deliberately a SECOND segment
 * under the host it belongs to rather than a top-level `/schema/patterns/`
 * listing: patterns are not their own schema, and the route says so. Pattern
 * names are unique within a host, which is all this slug has to disambiguate.
 * The host's schema is read off the pattern's own shape, so a host handed
 * across an island boundary without its `schemaName` still links correctly.
 */
export function srdPatternHref(host: SURefEntity, pattern: SURefObjectAnyPattern): string {
  const schemaName = isBioTitanPattern(pattern) ? 'bio-titans' : 'chassis'
  return patternHref(schemaName, getEntitySlug(host), nameToSlug(pattern.name))
}
