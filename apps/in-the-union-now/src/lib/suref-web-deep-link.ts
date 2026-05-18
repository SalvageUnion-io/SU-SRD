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

type EntityRef = {
  schemaName: string
  slug: string
}

const SUREF_WEB_BASE = 'https://salvageunion.io'

/**
 * Build a deep-link URL to a suref-web entity page.
 * @param schemaName - The schema ID (e.g., 'chassis', 'equipment', 'abilities')
 * @param slug - The entity slug (never UUID)
 * @returns Absolute URL to the entity on suref-web
 */
export function deepLinkTo({ schemaName, slug }: EntityRef): string {
  return `${SUREF_WEB_BASE}/schema/${schemaName}/item/${slug}`
}
