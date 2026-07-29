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
 * Breathing room around the tile in the capture frame.
 *
 * Not cosmetic: the catalog card is `overflow-visible`, so decorations render
 * OUTSIDE its box — a pattern tile's chassis name-tab sits 8px above it. An
 * element-scoped screenshot clips to the box, which sliced the top off that tab.
 * The frame is captured instead of the tile, so anything that overhangs is in
 * shot.
 *
 * 24px is headroom over the widest real overhang: pattern name-tabs reach 8px,
 * and `roll-tables/callsign-table` reaches 17px. `og-screenshots.ts` warns when
 * any entity exceeds this rather than silently shipping a clipped card — that
 * warning is what found the 17px case, so trust it over this comment if they
 * ever disagree.
 */
export const CATALOG_TILE_PADDING = 24

/** Total width of the captured frame — what the OG scale factor is derived from. */
export const CATALOG_FRAME_WIDTH = CATALOG_TILE_WIDTH + CATALOG_TILE_PADDING * 2

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
 * The generator writes the PNG here and rewrites the matching page's `og:image`
 * to point at it — keep both derived from this one function so a rename can't
 * silently 404 every social preview.
 *
 * A chassis pattern is addressed as an entity in its own right (it has its own
 * page, its own card view and its own provenance), mirroring its page URL with
 * the `.og.png` suffix moved to the end.
 */
export function ogImagePath(schemaId: string, itemId: string, patternId?: string): string {
  return patternId
    ? `/schema/${schemaId}/item/${itemId}/pattern/${patternId}.og.png`
    : `/schema/${schemaId}/item/${itemId}.og.png`
}
