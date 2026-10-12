import type { CSSProperties } from 'react'
import { color, font, fontSize, tracking, weight } from '../../design/tokens'
import type { CSSVarStyle } from '../../styles/cssVars'
import { CATALOG_TILE_CHROME, CATALOG_TILE_FILL, CATALOG_TILE_LABEL } from '../chrome/catalogTile'

/**
 * CatalogTile — the shared catalog-tile link. Callers resolve the
 * colours/href/name and pass them in; this owns the tile markup so the landing + 404 grids don't
 * duplicate it.
 *
 * The tile fill (and optional label chip fill) are driven by the `catalogBg` /
 * `catalogLabel` colour strings, applied as CSS custom properties so a caller
 * can pass any gradient or token. The frame, hover lift, focus ring and name
 * plate come from `chrome/catalogTile` — shared with `NavDrawer`, which renders
 * the same tile in its mobile drawer.
 */

type CatalogTileProps = {
  /** Where the tile navigates. Ignored when `onActivate` is set. */
  href?: string
  /**
   * Drill in place instead of navigating — the tile renders as a `<button>`
   * with identical chrome. The Dashboard's SRD Explorer shows the same catalog
   * inside a panel, where a link would take the player off the Dashboard.
   */
  onActivate?: () => void
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
const TILE_LAYOUT = {
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  minHeight: '54px',
} satisfies CSSProperties

const TILE_GHOST = { backgroundColor: color.paper, color: color.ink } satisfies CSSProperties

/** The `<button>` form (`onActivate`) spans its grid cell like the link does. */
const TILE_BUTTON = { textAlign: 'center', width: '100%' } satisfies CSSProperties

// Type comes off the ladder: the lede rung (15px) and caps-tight tracking
// (0.04em) replace a hand-set 16px size and 0.02em tracking. The 1px and
// 0.02em deltas are the price of being on the scale.
const NAME = {
  color: color.paper,
  fontFamily: font.cond,
  fontSize: fontSize.lede,
  fontWeight: weight.semibold,
  letterSpacing: tracking.capsTight,
  lineHeight: 1.2,
  textTransform: 'uppercase',
} satisfies CSSProperties

/** The drop shadow the bare name needs on a tone; the label plate replaces it. */
const NAME_SHADOW = { textShadow: `0 1px 2px ${color.ink75}` } satisfies CSSProperties

// Ghost name — cond/bold/uppercase at the inherited `lg` rung with no
// text-shadow (ink on paper needs none).
const NAME_GHOST = {
  color: color.ink,
  fontFamily: font.cond,
  fontSize: fontSize.lg,
  fontWeight: weight.bold,
  letterSpacing: tracking.capsTight,
  lineHeight: 'calc(1.75 / 1.125)',
  textTransform: 'uppercase',
} satisfies CSSProperties

export function CatalogTile({
  href,
  onActivate,
  name,
  catalogBg,
  catalogLabel,
  variant = 'default',
}: CatalogTileProps) {
  const isGhost = variant === 'ghost'

  const style: CSSVarStyle = {
    ...(catalogBg ? { '--catalog-bg': catalogBg } : {}),
    ...(catalogLabel ? { '--catalog-label': catalogLabel } : {}),
    ...TILE_LAYOUT,
    ...(isGhost ? TILE_GHOST : {}),
    ...(onActivate ? TILE_BUTTON : {}),
  }

  const className = isGhost ? CATALOG_TILE_CHROME : `${CATALOG_TILE_CHROME} ${CATALOG_TILE_FILL}`
  const label = isGhost ? (
    <span style={NAME_GHOST}>{name}</span>
  ) : (
    <span
      className={catalogLabel ? CATALOG_TILE_LABEL : undefined}
      style={catalogLabel ? NAME : { ...NAME, ...NAME_SHADOW }}
    >
      {name}
    </span>
  )

  if (onActivate) {
    return (
      <button type="button" onClick={onActivate} className={className} style={style}>
        {label}
      </button>
    )
  }

  return (
    <a href={href} className={className} style={style}>
      {label}
    </a>
  )
}
