/**
 * Shared geometry for the per-entity og:image cards.
 *
 * One module so the render surface (`pages/og-card.astro`), the generator
 * (`scripts/og-screenshots.ts`) and the item page that references the output
 * path can never disagree about width, canvas size, or file location.
 */
import { itemHref, patternHref } from './entityHref'

/**
 * Viewport the catalog tile is laid out at.
 *
 * NOT the same thing as the tile's own width, and the distinction is load-
 * bearing: the card carries viewport media queries (`md:flex-row`, `md:w-2/5`,
 * `sm:columns-2`, `lg:grid-cols-2`), so the BREAKPOINT STATE decides its shape
 * — artwork beside the prose on desktop, stacked above it on mobile.
 *
 * 1440px is the desktop breakpoint the 3-up masonry grid is measured at, so
 * pinning it reproduces the tile a desktop reader actually sees. Rendering at
 * the tile's own width instead (as this did until the wide-card pass) leaves
 * every `sm:`/`md:`/`lg:` variant OFF, capturing the mobile stack: a tall,
 * narrow card that letterboxes into thin pillars on a 1200×630 canvas.
 */
export const CATALOG_VIEWPORT_WIDTH = 1440

/**
 * Narrowest tile width considered — the measured rendered width of a tile in
 * the 3-up masonry grid at CATALOG_VIEWPORT_WIDTH.
 *
 * The index tile is fluid (`flex-1` inside `MasonryColumns`), so it has no
 * intrinsic width to inherit and no single width is "the" catalog width — a
 * 1-up or 2-up column at the same viewport is the same tile, laid out wider.
 * That is what makes picking a per-entity width (see `pickTileWidth`) a
 * re-flow of the real Catalog tile rather than an OG-only re-layout.
 */
export const CATALOG_TILE_MIN_WIDTH = 432

/**
 * Widest tile width considered.
 *
 * Bounded by the canvas rather than by taste: 1008 + padding = 1056, just under
 * OG_WIDTH, so even the widest candidate is rasterised at or above its final
 * size and is never upscaled onto the canvas. Past this the prose measure runs
 * long enough to read badly at preview size, and the fill curve is already
 * falling — a card wide enough to want more than this has no content to fill it.
 */
export const CATALOG_TILE_MAX_WIDTH = 1008

/**
 * Spacing of the width ladder `pickTileWidth` chooses from.
 *
 * The fill curve is smooth in width, so 32px lands within ~1% of the true
 * optimum while keeping the measurement pass to ~19 synchronous re-layouts.
 */
export const CATALOG_TILE_WIDTH_STEP = 32

/** Candidate tile widths, narrowest first — `pickTileWidth`'s search space. */
export const CATALOG_TILE_WIDTHS: readonly number[] = Array.from(
  {
    length:
      Math.floor((CATALOG_TILE_MAX_WIDTH - CATALOG_TILE_MIN_WIDTH) / CATALOG_TILE_WIDTH_STEP) + 1,
  },
  (_, i) => CATALOG_TILE_MIN_WIDTH + i * CATALOG_TILE_WIDTH_STEP
)

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

/**
 * Width of the NARROWEST captured frame — what the capture scale is derived
 * from. Rasterising the narrowest candidate at exactly OG_WIDTH means every
 * wider candidate is rasterised larger than the canvas and downsampled, so no
 * chosen width is ever upscaled.
 */
export const CATALOG_MIN_FRAME_WIDTH = CATALOG_TILE_MIN_WIDTH + CATALOG_TILE_PADDING * 2

/**
 * og:image canvas. 1200×630 is the size BaseLayout declares for every image the
 * site emits (`og:image:width` / `:height`), and the ratio Slack/Discord/X/
 * Facebook render a "large" link card at.
 */
export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

/**
 * Fraction of the og canvas a frame covers once `contain`-fitted onto it.
 *
 * `contain` scales by whichever axis binds first and letterboxes the other, so
 * this peaks at 1 when the frame's aspect matches the canvas and falls away in
 * both directions. Maximising it is exactly "take up as much of the preview as
 * possible", which is why it — and not the aspect error — is the score.
 */
export function frameFill(frameWidth: number, frameHeight: number): number {
  if (frameWidth <= 0 || frameHeight <= 0) return 0
  const scale = Math.min(OG_WIDTH / frameWidth, OG_HEIGHT / frameHeight)
  return (frameWidth * scale * (frameHeight * scale)) / (OG_WIDTH * OG_HEIGHT)
}

/** One candidate: the tile's own laid-out height at a given tile width. */
export type TileMeasurement = { width: number; height: number }

/**
 * How much better a wider tile must fill the canvas before it wins.
 *
 * The narrow end of the ladder is the tile a desktop reader sees in the grid,
 * so widening needs to buy real canvas, not a rounding difference.
 */
export const TILE_FILL_EPSILON = 0.005

/**
 * Pick the tile width whose card fills the most of the og canvas.
 *
 * Card height is a step function of width (text re-wraps, artwork does not), so
 * there is no closed form — the generator measures the real card at every
 * candidate width and this scores those measurements. Ties, and near-ties
 * within TILE_FILL_EPSILON, go to the NARROWEST width: the closest to the grid
 * tile, so the card only widens when widening actually buys canvas.
 */
export function pickTileWidth(measurements: readonly TileMeasurement[]): number {
  const scored = measurements
    .filter((m) => m.width > 0 && m.height > 0)
    .map((m) => ({
      width: m.width,
      fill: frameFill(m.width + CATALOG_TILE_PADDING * 2, m.height + CATALOG_TILE_PADDING * 2),
    }))
  if (scored.length === 0) return CATALOG_TILE_MIN_WIDTH
  const best = Math.max(...scored.map((s) => s.fill))
  return Math.min(...scored.filter((s) => s.fill >= best - TILE_FILL_EPSILON).map((s) => s.width))
}

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
 *
 * "Mirrors the page URL" is enforced, not merely asserted: the path is DERIVED
 * from the same `itemHref`/`patternHref` grammar the page routes are built from,
 * with the trailing slash swapped for the extension. Hand-writing the segments
 * here a second time is how a route rename silently 404s every social preview.
 */
export function ogImagePath(schemaId: string, itemId: string, patternId?: string): string {
  const pageHref = patternId ? patternHref(schemaId, itemId, patternId) : itemHref(schemaId, itemId)
  return `${pageHref.slice(0, -1)}.og.png`
}
