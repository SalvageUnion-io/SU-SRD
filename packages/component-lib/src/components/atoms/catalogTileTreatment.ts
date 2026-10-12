import { FOCUS_RING } from './interaction'

/**
 * The catalog-tile treatment — the wayfinding tile shared by the srd landing
 * grid, the 404 grid (`CatalogTile`) and the mobile nav drawer (`NavDrawer`).
 *
 * It lives here, beside `STAMP_SEAM` and `POSTER_STAMP`, for the same reason
 * they do: it is a treatment used by more than one component, and the two
 * copies had already drifted apart in the ways duplicated class strings always
 * do. `NavDrawer` carried a verbatim second copy of the frame AND of the label
 * chip, so a change to the tile reached the landing page and silently missed
 * the drawer.
 *
 * WHY THE TILE NAME IS NOT A `Badge`. The obvious next step — routing the label
 * chip through `Badge shape="chip"` — is deliberately NOT taken. Badge's chip is
 * a fixed-height (22px) `text-badge` (11px) KEYWORD chip; the tile's name is the
 * tile's entire content at reading scale. Forcing it through Badge would mean
 * overriding its height, padding, type scale and fill — every part of the
 * geometry that makes it a Badge — leaving only `rounded-badge` shared. That is
 * the shape of a primitive being worn as a costume, not reused. Badge is
 * label-only by design (see its own doc comment); this is a plate around a
 * heading, which is a different kind, so it keeps its own constant.
 */

/**
 * Frame + interaction, minus the fill (`.su-catalog-tile` in
 * `styles/index.css`, hover lift and transition included). The fill uses the
 * `background` shorthand, not `background-color`, because `--catalog-bg` may
 * be a gradient — the tech-level and ability-tier ramps — and
 * `background-color` silently drops a `linear-gradient()`, which once left
 * those tiles unfilled with unreadable paper text on the pale page ground.
 */
export const CATALOG_TILE_CHROME = `su-catalog-tile ${FOCUS_RING}`

/** The coloured fill + paper text (the default, non-ghost tile). */
export const CATALOG_TILE_FILL = 'su-catalog-tile--fill'

/**
 * The optional name plate — a `--catalog-label` filled chip around the tile
 * name. `text-shadow: none` because the plate supplies the contrast the drop
 * shadow was standing in for.
 */
export const CATALOG_TILE_LABEL = 'su-catalog-tile__label'
