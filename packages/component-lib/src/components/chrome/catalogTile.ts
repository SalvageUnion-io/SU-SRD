import { cn } from '../../utils/cn'
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
 * Frame + interaction, minus the fill. `background` shorthand (not `bg-[…]`,
 * which compiles to `background-color`) because `--catalog-bg` may be a
 * gradient — the tech-level and ability-tier ramps — and `background-color`
 * silently drops a `linear-gradient()`, which once left those tiles unfilled
 * with unreadable paper text on the pale page ground.
 */
export const CATALOG_TILE_CHROME = cn(
  'rounded-card border-chrome border-ink px-[15px] py-[13px] no-underline',
  'transition-[box-shadow,transform] duration-[120ms]',
  'hover:-translate-y-0.5 hover:shadow-[0_5px_18px_var(--color-ink-20)]',
  FOCUS_RING
)

/** The coloured fill + paper text (the default, non-ghost tile). */
export const CATALOG_TILE_FILL = '[background:var(--catalog-bg)] text-paper'

/**
 * The optional name plate — a `--catalog-label` filled chip around the tile
 * name. `text-shadow:none` because the plate supplies the contrast the drop
 * shadow was standing in for.
 */
export const CATALOG_TILE_LABEL =
  'inline-block rounded-badge bg-[var(--catalog-label)] px-[10px] py-0.5 [text-shadow:none]'
