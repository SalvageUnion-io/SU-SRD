/**
 * The Cantina's links into the reference pages: the paths the pages are
 * emitted at (`entityHref.ts`, trailing slash and all), absolute on the page's
 * own origin (`pageOrigin`), because a root-relative path handed to the router
 * would read as one of the Cantina's own routes under `/build`.
 *
 * Slugs, never UUIDs (`getEntitySlug`).
 */

import { getEntitySchemas, getEntitySlug } from 'salvageunion-reference'
import type { EntityHrefBuilder } from '../components/index'
import { itemHref, schemaHref } from './entityHref'
import { pageOrigin } from './site'

type EntityRef = {
  schemaName: string
  slug: string
}

// srd generates item pages for ENTITY schemas only: getItemStaticPaths in
// apps/web/src/lib/staticPaths.ts iterates getEntitySchemas(), which is
// getSchemaCatalog().schemas.filter((s) => !s.meta). So full catalog
// membership is NOT the test — it would claim a page for the three meta
// schemas (actions, catalog-categories, ability-tree-requirements) and every
// "View in SRD" on an action would 404. Mirror the generator's own filter.
// Lazily cached.
let srdSchemaIds: Set<string> | undefined

/**
 * Whether srd publishes an item page for entities of this schema —
 * i.e. whether a "View in SRD" deep link would resolve.
 */
export function hasSRDPage(schemaName: string): boolean {
  if (!srdSchemaIds) {
    srdSchemaIds = new Set(getEntitySchemas().map((schema) => schema.id))
  }
  return srdSchemaIds.has(schemaName)
}

/**
 * Build a deep-link URL to a srd entity page.
 * @param schemaName - The schema ID (e.g., 'chassis', 'equipment', 'abilities')
 * @param slug - The entity slug (never UUID)
 * @returns Absolute URL to the entity on srd
 */
export function deepLinkTo({ schemaName, slug }: EntityRef): string {
  return `${pageOrigin()}${itemHref(schemaName, slug)}`
}

/**
 * Build a deep-link URL to a srd schema index page (the category
 * listing, e.g. /chassis). Used by reference search's category rows —
 * The Cantina has no in-app schema list routes.
 */
export function deepLinkToSchema(schemaName: string): string {
  return `${pageOrigin()}${schemaHref(schemaName)}`
}

/**
 * The Cantina's entity href builder for nested reference-entity links,
 * supplied app-wide through `EntityHrefProvider` in `routes/__root.tsx`: the
 * entity's reference page.
 *
 * Gated on `hasSRDPage`, exactly like `srdEntityExternalLink`: no page is
 * emitted for a meta schema, so an ungated link on e.g. an action would render
 * as a link and 404. No href means the card renders plain text.
 */
export const cantinaEntityHref: EntityHrefBuilder = (entity) => {
  const schemaName =
    'schemaName' in entity && typeof entity.schemaName === 'string' ? entity.schemaName : undefined
  if (!schemaName || !hasSRDPage(schemaName)) return undefined
  return deepLinkTo({ schemaName, slug: getEntitySlug(entity) })
}
