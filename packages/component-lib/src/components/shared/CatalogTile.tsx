import type { CSSVarStyle } from '../../styles/cssVars'
import { cn } from '../../utils/cn'
import { CATALOG_TILE_CHROME, CATALOG_TILE_FILL, CATALOG_TILE_LABEL } from '../chrome/catalogTile'

/**
 * CatalogTile — the shared catalog-tile link (canonical; converted from
 * srd's CatalogTile.astro). Callers resolve the colours/href/name and
 * pass them in; this owns the tile markup so the landing + 404 grids don't
 * duplicate it.
 *
 * The tile fill (and optional label chip fill) are driven by the `catalogBg` /
 * `catalogLabel` colour strings, applied as CSS custom properties so a caller
 * can pass any gradient or token. The frame, hover lift, focus ring and name
 * plate come from `chrome/catalogTile` — shared with `NavDrawer`, which renders
 * the same tile in its mobile drawer and used to carry a verbatim second copy
 * of both strings.
 */

type CatalogTileProps = {
  href: string
  name: string
  /** Tile background — any CSS color/gradient string. Required by the default
   *  variant; the `ghost` variant ignores it (it fills with paper). */
  catalogBg?: string
  /** When set, the name renders as a chip filled with this color. */
  catalogLabel?: string | null
  /**
   * `default` — full-bleed coloured tile with paper text (the catalog grids).
   * `ghost` — paper fill / ink text (the 404 "Return to Home" link).
   */
  variant?: 'default' | 'ghost'
}

/** What the GRID tile adds to the shared chrome. The drawer tile is a
 *  full-width block instead, which is why this is not in the shared constant. */
const TILE_LAYOUT = 'flex min-h-[54px] flex-col items-center justify-center'

const TILE_GHOST = 'bg-paper text-ink'

// Type comes off the ladder: `text-lede` (15px) and `tracking-caps-tight`
// (0.04em) replace a hand-set 16px size and 0.02em tracking — both arbitrary
// bracket values of the kind the token guard tracks. The 1px and 0.02em deltas
// are the price of being on the scale. (Named in prose rather than quoted in
// their utility form on purpose: the guard reads comments, and a citation of
// the thing you removed counts as the thing itself.)
const NAME =
  'font-cond text-lede font-semibold uppercase leading-[1.2] tracking-caps-tight text-paper [text-shadow:0_1px_2px_rgba(0,0,0,0.75)]'

// Ghost name — cond/bold/uppercase at text-lg with no text-shadow (ink on paper
// needs none), matching the former `.catalog-item--ghost`.
const NAME_GHOST = 'font-cond text-lg font-bold uppercase tracking-caps-tight text-ink'

export function CatalogTile({
  href,
  name,
  catalogBg,
  catalogLabel,
  variant = 'default',
}: CatalogTileProps) {
  const isGhost = variant === 'ghost'

  const style: CSSVarStyle = {
    ...(catalogBg ? { '--catalog-bg': catalogBg } : {}),
    ...(catalogLabel ? { '--catalog-label': catalogLabel } : {}),
  }

  return (
    <a
      href={href}
      className={cn(CATALOG_TILE_CHROME, TILE_LAYOUT, isGhost ? TILE_GHOST : CATALOG_TILE_FILL)}
      style={style}
    >
      <span className={isGhost ? NAME_GHOST : cn(NAME, catalogLabel && CATALOG_TILE_LABEL)}>
        {name}
      </span>
    </a>
  )
}
