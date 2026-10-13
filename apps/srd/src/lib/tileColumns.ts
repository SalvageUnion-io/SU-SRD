import type { CSSVarStyle } from 'component-lib'

/**
 * How many tiles a Catalog line sets, by group size, so a group never strands
 * a tile alone on its last line.
 *
 * The grid's own `auto-fill` fits as many columns as the measure holds (five at
 * 1200px) and runs the rest onto a short last line: the six base classes were
 * five and an orphaned Soldier, chassis TL1's eight five and three. A group
 * instead keeps the fewest lines it needs at that width and shares its tiles
 * evenly across them, so a size with a divisor that fits fills every line
 * (6 → 3 + 3, 8 → 4 + 4) and any other falls short by the least it can
 * (7 → 4 + 3). A group one line holds keeps the grid's columns. A tile keeps
 * the width it has in a full line either way (`pages.css`), so a balanced
 * group is a narrower block of the same tiles.
 */
export function balancedColumns(count: number, fit: number): number {
  if (count <= fit) return fit
  const lines = Math.ceil(count / fit)
  return Math.ceil(count / lines)
}

/**
 * The most columns the Catalog's grid fits: six at the listing's 87.5rem
 * measure with 13.5rem tracks (`pages.css`, `.srd-listing__tiles`).
 */
const MAX_FIT = 6

/**
 * A group's column count at each width step, as the custom properties
 * `pages.css` reads: `--srd-tiles-N` is the columns to set where the line fits
 * N tiles. Spread on a tile grid that carries `data-balanced`.
 */
export function tileColumnStyle(count: number): CSSVarStyle {
  const style: CSSVarStyle = {}
  for (let fit = 2; fit <= MAX_FIT; fit++) {
    style[`--srd-tiles-${fit}`] = balancedColumns(count, fit)
  }
  return style
}
