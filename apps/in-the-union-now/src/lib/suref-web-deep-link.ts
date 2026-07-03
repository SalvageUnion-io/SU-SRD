/**
 * Deep-link URL builder for suref-web entity pages.
 *
 * Verified suref-web URL pattern (from apps/suref-web/src/pages/):
 *   Base: https://salvageunion.io
 *   Item route: /schema/[schemaId]/item/[itemSlug]
 *   Uses slugs (never UUIDs) per CLAUDE.md data convention
 *
 * See: apps/suref-web/src/pages/schema/[schemaId]/item/[itemId].astro
 */

import { getSchemaCatalog } from 'salvageunion-reference'

type EntityRef = {
  schemaName: string
  slug: string
}

const SUREF_WEB_BASE = 'https://salvageunion.io'

// suref-web statically generates an item page for every schema in the
// reference catalog (see apps/suref-web/src/lib/staticPaths.ts —
// getItemStaticPaths iterates getSchemaCatalog().schemas), so catalog
// membership is the "an SRD page exists" test. Lazily cached.
let srdSchemaIds: Set<string> | undefined

/**
 * Whether suref-web publishes an item page for entities of this schema —
 * i.e. whether a "View in SRD" deep link would resolve.
 */
export function hasSRDPage(schemaName: string): boolean {
  if (!srdSchemaIds) {
    srdSchemaIds = new Set(getSchemaCatalog().schemas.map((schema) => schema.id))
  }
  return srdSchemaIds.has(schemaName)
}

/**
 * Build a deep-link URL to a suref-web entity page.
 * @param schemaName - The schema ID (e.g., 'chassis', 'equipment', 'abilities')
 * @param slug - The entity slug (never UUID)
 * @returns Absolute URL to the entity on suref-web
 */
export function deepLinkTo({ schemaName, slug }: EntityRef): string {
  return `${SUREF_WEB_BASE}/schema/${schemaName}/item/${slug}`
}

/**
 * Build a deep-link URL to a suref-web schema index page (the category
 * listing, e.g. /schema/chassis). Used by reference search's category rows —
 * ITUN has no in-app schema list routes.
 */
export function deepLinkToSchema(schemaName: string): string {
  return `${SUREF_WEB_BASE}/schema/${schemaName}`
}
