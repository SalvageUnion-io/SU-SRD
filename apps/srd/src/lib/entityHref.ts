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
 * It used to re-author the grammar instead of composing it, and the two copies
 * had already diverged — the package emitted `/schema/x/item/y`, this file
 * `/schema/x/item/y/`. Nothing failed, because directory-style output redirects
 * the un-slashed form, so the cost was a redirect hop on every inbound deep
 * link plus two spellings of the canonical URL. The structural cost was worse:
 * changing the route pattern here would have left the package emitting the old
 * path, silently 404ing every external link.
 *
 * (The previous version of this note justified itself with `trailingSlash:
 * 'ignore'` in `astro.config.mjs` — a file deleted when srd moved off Astro,
 * ADR-031.)
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
