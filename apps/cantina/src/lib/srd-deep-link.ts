/**
 * Deep-link URL builder for srd entity pages.
 *
 * Verified srd URL pattern (from apps/srd/src/pages/):
 *   Base: `SRD_ORIGIN` (https://salvageunion.io, or a Worker Preview's SRD)
 *   Item route: /[schemaId]/[itemSlug]
 *   Uses slugs (never UUIDs) per CLAUDE.md data convention
 *
 * See: apps/srd/src/pages/[schemaId]/[itemId].page.tsx
 */

import { getEntitySchemas, srdEntityPath, srdSchemaPath } from 'salvageunion-reference'
import { SRD_ORIGIN } from './srdOrigin'

type EntityRef = {
  schemaName: string
  slug: string
}

// srd generates item pages for ENTITY schemas only: getItemStaticPaths in
// apps/srd/src/lib/staticPaths.ts iterates getEntitySchemas(), which is
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
  return `${SRD_ORIGIN}${srdEntityPath(schemaName, slug)}`
}

/**
 * Build a deep-link URL to a srd schema index page (the category
 * listing, e.g. /chassis). Used by reference search's category rows —
 * The Cantina has no in-app schema list routes.
 */
export function deepLinkToSchema(schemaName: string): string {
  return `${SRD_ORIGIN}${srdSchemaPath(schemaName)}`
}
