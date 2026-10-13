import type { CSSProperties } from 'react'
import { color, font, fontSize, tracking, weight } from '../../design/tokens'
import type { CSSVarStyle } from '../../styles/cssVars'
import { FOCUS_RING } from './interaction'

/**
 * CatalogTile — the catalog tile the Dashboard's SRD Explorer drills through.
 * The caller resolves the colours and name and passes them in; this owns the
 * tile markup.
 *
 * The tile fill (and optional label chip fill) are driven by the `catalogBg` /
 * `catalogLabel` colour strings, applied as CSS custom properties so a caller
 * can pass any gradient or token. The fill (`.su-catalog-tile--fill`) uses the
 * `background` shorthand, not `background-color`, because `--catalog-bg` may
 * be a gradient — the tech-level and ability-tier ramps — and
 * `background-color` silently drops a `linear-gradient()`, which once left
 * those tiles unfilled with unreadable paper text on the pale page ground.
 *
 * WHY THE TILE NAME IS NOT A `Badge`: Badge's chip is a fixed-height (22px)
 * 11px KEYWORD chip; the tile's name is the tile's entire content at reading
 * scale. Forcing it through Badge would override every part of the geometry
 * that makes it a Badge, so the name plate keeps its own class.
 */

type CatalogTileProps = {
  /**
   * Drill in place — the tile is a `<button>`. The SRD Explorer shows the
   * catalog inside a panel, where a link would take the player off the Dashboard.
   */
  onActivate: () => void
  name: string
  /** Tile background — any CSS color/gradient string. */
  catalogBg: string
  /** When set, the name renders as a chip filled with this color. */
  catalogLabel?: string | null
}

const TILE = {
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  minHeight: '54px',
  textAlign: 'center',
  width: '100%',
} satisfies CSSProperties

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

export function CatalogTile({ onActivate, name, catalogBg, catalogLabel }: CatalogTileProps) {
  const style: CSSVarStyle = {
    '--catalog-bg': catalogBg,
    ...(catalogLabel ? { '--catalog-label': catalogLabel } : {}),
    ...TILE,
  }

  return (
    <button
      type="button"
      onClick={onActivate}
      className={`su-catalog-tile su-catalog-tile--fill ${FOCUS_RING}`}
      style={style}
    >
      <span
        className={catalogLabel ? 'su-catalog-tile__label' : undefined}
        style={catalogLabel ? NAME : { ...NAME, ...NAME_SHADOW }}
      >
        {name}
      </span>
    </button>
  )
}
