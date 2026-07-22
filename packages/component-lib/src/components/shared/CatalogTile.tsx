import type { CSSProperties } from 'react'
import { cn } from '../../utils/cn'

/**
 * CatalogTile — the shared catalog-tile link (canonical; converted from
 * srd's CatalogTile.astro). Callers resolve the colours/href/name and
 * pass them in; this owns the tile markup so the landing + 404 grids don't
 * duplicate it.
 *
 * The tile fill (and optional label chip fill) are driven by the `catalogBg` /
 * `catalogLabel` colour strings, applied as CSS custom properties so a caller
 * can pass any gradient or token. Styling is self-contained (the former
 * `.catalog-item` global rules, replicated as utilities) so it renders
 * identically in Ladle and in the static site.
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

// Geometry + interaction shared by both variants. `--catalog-bg` may be a colour
// OR a gradient (tech-level ramps, the ability tier ramp), so the default fill
// must use the `background` shorthand — `bg-[…]` compiles to `background-color`,
// which silently drops a `linear-gradient()` and left those tiles unfilled with
// unreadable paper text on the pale page ground.
const TILE_BASE =
  'flex min-h-[54px] flex-col items-center justify-center rounded-card border-chrome border-ink px-[15px] py-[13px] no-underline transition-[box-shadow,transform] duration-[120ms] hover:-translate-y-0.5 hover:shadow-[0_5px_18px_rgba(34,30,23,0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pilot'

const TILE_DEFAULT = '[background:var(--catalog-bg)] text-paper'
const TILE_GHOST = 'bg-paper text-ink'

const NAME =
  'font-cond text-[16px] font-semibold uppercase leading-[1.2] tracking-[0.02em] text-paper [text-shadow:0_1px_2px_rgba(0,0,0,0.75)]'

const NAME_LABEL =
  'inline-block rounded-badge bg-[var(--catalog-label)] px-[10px] py-0.5 [text-shadow:none]'

// Ghost name — cond/bold/uppercase at text-lg (1.125rem) with 0.02em tracking
// and no text-shadow (ink on paper needs none), matching the former
// `.catalog-item--ghost`.
const NAME_GHOST = 'font-cond text-lg font-bold uppercase tracking-[0.02em] text-ink'

export function CatalogTile({
  href,
  name,
  catalogBg,
  catalogLabel,
  variant = 'default',
}: CatalogTileProps) {
  const isGhost = variant === 'ghost'

  const style = {
    ...(catalogBg ? { '--catalog-bg': catalogBg } : {}),
    ...(catalogLabel ? { '--catalog-label': catalogLabel } : {}),
  } as CSSProperties

  return (
    <a href={href} className={cn(TILE_BASE, isGhost ? TILE_GHOST : TILE_DEFAULT)} style={style}>
      <span className={isGhost ? NAME_GHOST : cn(NAME, catalogLabel && NAME_LABEL)}>{name}</span>
    </a>
  )
}
