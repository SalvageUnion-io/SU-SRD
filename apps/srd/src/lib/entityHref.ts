import { getEntitySlug } from 'salvageunion-reference'
import type { EntityHrefBuilder } from 'component-lib'

/**
 * THE srd route grammar. Every internal link to a schema listing, an entity show
 * page or a pattern page is built here and nowhere else.
 *
 * It used to be hand-built at eight call sites (islands, static-link resolution,
 * pattern hrefs, og-card tiles, Astro pages) — eight copies of one string, each
 * free to drift on the trailing slash or the segment order. `trailingSlash:
 * 'ignore'` (astro.config.mjs) means such drift 404s nothing, so it would have
 * gone unnoticed while quietly splitting canonical URLs in two.
 *
 * The path segment is always a SLUG, never a uuid — see `getEntitySlug`.
 */
export function schemaHref(schemaName: string): string {
  return `/schema/${schemaName}/`
}

/** An entity's show page: `/schema/<schema>/item/<slug>/`. */
export function itemHref(schemaName: string, slug: string): string {
  return `${schemaHref(schemaName)}item/${slug}/`
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
