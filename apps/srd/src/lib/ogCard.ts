/**
 * Shared geometry for the per-entity og:image cards.
 *
 * One module so the render surface (`pages/og-card.astro`), the generator
 * (`scripts/og-screenshots.ts`) and the item page that references the output
 * path can never disagree about width, canvas size, or file location.
 */

/**
 * CSS width the schema index gives a catalog tile at a desktop viewport.
 *
 * The index tile is fluid — `flex-1` inside a 3-up `MasonryColumns` — so it has
 * no intrinsic width to inherit. 432px is the measured rendered width at a
 * 1440px viewport (the 3-column breakpoint), i.e. the tile a desktop reader
 * actually sees. Pinning it here is what makes the og:image a 1:1 render of the
 * Catalog view rather than an OG-only re-layout.
 */
export const CATALOG_TILE_WIDTH = 432

/**
 * og:image canvas. 1200×630 is the size BaseLayout declares for every image the
 * site emits (`og:image:width` / `:height`), and the ratio Slack/Discord/X/
 * Facebook render a "large" link card at.
 */
export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

/**
 * Where an entity's og:image lives, relative to the site root.
 *
 * `[itemId].astro` points `og:image` at this path and the generator writes the
 * PNG to the matching location under `dist/` — keep them derived from this one
 * function so a rename can't silently 404 every social preview.
 */
export function ogImagePath(schemaId: string, itemId: string): string {
  return `/schema/${schemaId}/item/${itemId}.og.png`
}
