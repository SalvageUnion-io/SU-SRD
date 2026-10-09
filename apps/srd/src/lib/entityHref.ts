import type { EntityHrefBuilder } from 'component-lib'
import { getEntitySlug, srdEntityPath, srdSchemaPath } from 'salvageunion-reference'

/**
 * srd's TRAILING-SLASH policy over the shared route grammar.
 *
 * The grammar itself — which segments in which order — lives in
 * `salvageunion-reference/lib/assets.ts` (`srdSchemaPath` / `srdEntityPath`),
 * because the Discord bot and ITUN link into this site and must build the same
 * paths. This module adds the one thing that is genuinely srd's own: the
 * trailing slash its directory-style output wants.
 *
 * It composes the grammar rather than re-authoring it: two copies drift, and
 * because directory-style output redirects the un-slashed form, the drift fails
 * nothing — it costs a redirect hop on every inbound deep link, two spellings of
 * the canonical URL, and, once the route pattern changes, a package emitting a
 * path that silently 404s every external link.
 *
 * The path segment is always a SLUG, never a uuid — see `getEntitySlug`.
 */
export function schemaHref(schemaName: string): string {
  return `${srdSchemaPath(schemaName)}/`
}

/** An entity's show page: `/schema/<schema>/item/<slug>/`. */
export function itemHref(schemaName: string, slug: string): string {
  return `${srdEntityPath(schemaName, slug)}/`
}

/**
 * A chassis pattern's page — a SECOND segment under the item it belongs to, not
 * a top-level listing. See `srdPatternHref` in ./patternHref for why.
 */
export function patternHref(schemaName: string, slug: string, patternSlug: string): string {
  return `${itemHref(schemaName, slug)}pattern/${patternSlug}/`
}

/**
 * srd's show-page route for an entity, as a `component-lib` href builder.
 * Supplied to component-lib via `EntityHrefProvider` so nested "View Details"
 * links resolve to this app's routes (the shared library stays route-agnostic).
 */
export const srdEntityHref: EntityHrefBuilder = (entity) => {
  const schemaName =
    'schemaName' in entity && typeof entity.schemaName === 'string' ? entity.schemaName : undefined
  return schemaName ? itemHref(schemaName, getEntitySlug(entity)) : undefined
}
