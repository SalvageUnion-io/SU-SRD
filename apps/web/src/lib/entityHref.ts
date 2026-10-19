import type { EntityRef, RefEntity } from 'salvageunion-reference'
import {
  getEntitySchemas,
  getEntitySlug,
  nameToSlug,
  srdEntityPath,
  srdSchemaPath,
} from 'salvageunion-reference'

/**
 * srd's TRAILING-SLASH policy over the shared route grammar.
 *
 * The grammar itself — which segments in which order — lives in
 * `salvageunion-reference/lib/assets.ts` (`srdSchemaPath` / `srdEntityPath`),
 * because the Discord bot and the app link into this site and must build the same
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

/** An entity's show page: `/<schema>/<slug>/`. */
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

// Item pages are emitted for ENTITY schemas only (`getItemStaticPaths` in
// `staticPaths.ts` iterates `getEntitySchemas()`): the meta schemas
// (actions, catalog-categories, ability-tree-requirements) are in the catalog
// but have no page. Lazily cached.
let pageSchemaIds: Set<string> | undefined

/** Whether the site emits an item page for entities of this schema. */
export function hasPage(schemaName: string): boolean {
  pageSchemaIds ??= new Set(getEntitySchemas().map((schema) => schema.id))
  return pageSchemaIds.has(schemaName)
}

/**
 * An entity's page, from the record: the app's "View in the Reference" link
 * (`srdEntityExternalLink`). Root-relative: the app renders it as a plain
 * anchor, never through its router.
 *
 * Only a dataset record of a schema with pages has one. A record with no `id`
 * was assembled for display (a crawler bay's commander is its bay's embedded
 * `npc` object, dressed as an `npcs` entity so it wears the NPC card,
 * `resolveNestedEntities`), and a meta schema has no pages; a link built for
 * either would 404, so it gets none and renders unlinked.
 */
export function entityHref(entity: RefEntity): string | undefined {
  const schemaName =
    'schemaName' in entity && typeof entity.schemaName === 'string' ? entity.schemaName : undefined
  const isRecord = 'id' in entity && typeof entity.id === 'string' && entity.id.length > 0
  return schemaName && isRecord && hasPage(schemaName)
    ? itemHref(schemaName, getEntitySlug(entity))
    : undefined
}

/**
 * srd's routes as the entity SURFACE's `hrefFor` (`EntitySurfaceProvider`):
 * an entity's page, or a pattern's under its chassis. A synthetic ref (built
 * from embedded data, no dataset row) and a meta schema's (an action) have no
 * page.
 */
export function srdHrefFor(ref: EntityRef): string | undefined {
  if (ref.synthetic || !hasPage(ref.schemaName)) return undefined
  return ref.pattern
    ? patternHref(ref.schemaName, ref.slug, nameToSlug(ref.pattern))
    : itemHref(ref.schemaName, ref.slug)
}
