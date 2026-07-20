import { forwardRef } from 'react'
import type { ElementType, HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { STAMP_SEAM } from './stampSeam'
import { DEFAULT_RUNG, RUNG_INLINE_PADDING, RUNG_TYPE, type SizeRung } from '../../styles/sizing'

export type BadgeTone = 'pilot' | 'mech' | 'crawler' | 'ok' | 'warn' | 'bad'
/** Chip surfaces (the rounded `shape="chip"` default). */
export type BadgeSurface = 'solid' | 'ghost' | 'outline' | 'tone' | 'quiet'
/**
 * Stamp text scale — the canonical FULL / COMPACT / MINI ladder (see
 * `src/styles/sizing.ts`, `Foundations/Sizing`). Badge is the reference
 * implementation of that vocabulary: every three-step size axis in the system
 * uses these names, so a size means the same thing wherever it is read.
 */
export type StampSize = SizeRung
/** Stamp plate (`shape="stamp"`). */
export type StampSurface = 'on-ink' | 'inverse' | 'on-tone'

/** Tone fills for `surface="tone"` — kind fills frame in ink, status fills self-border. */
const BADGE_TONES: Record<BadgeTone, string> = {
  pilot: 'border-ink bg-pilot text-ink',
  mech: 'border-ink bg-mech text-ink',
  crawler: 'border-ink bg-crawler text-paper',
  ok: 'border-status-ok bg-status-ok text-paper',
  warn: 'border-status-warn bg-status-warn text-paper',
  bad: 'border-status-bad bg-status-bad text-paper',
}

/** Per-surface geometry — every chip is a fixed 22px, rounded-badge stamp-chip. */
const BADGE_SURFACE: Record<BadgeSurface, string> = {
  solid: 'px-[7px] bg-ink text-paper tracking-caps-snug',
  ghost: 'px-[7px] bg-paper text-ink ring-1 ring-inset ring-ink/20 tracking-caps-snug',
  outline: 'px-[9px] border-2 border-ink bg-paper text-ink tracking-caps',
  tone: 'px-[9px] border-2 tracking-caps',
  quiet: 'px-2 bg-wk-bg-2 text-ink-2',
}

/**
 * Stamp geometry per rung, COMPOSED from the ladder rather than restated, so a
 * change to the scale reaches the stamp instead of drifting away from it.
 * `compact` is the default — the rung a stamp sits at when nothing is asked.
 */
const STAMP_SIZE: Record<StampSize, string> = {
  full: cn(RUNG_INLINE_PADDING.full, RUNG_TYPE.full.label),
  compact: cn(RUNG_INLINE_PADDING.compact, RUNG_TYPE.compact.label),
  mini: cn(RUNG_INLINE_PADDING.mini, RUNG_TYPE.mini.label),
}

/** Stamp plate fills — the square label/header shape. */
const STAMP_SURFACE: Record<StampSurface, string> = {
  'on-ink': 'bg-ink text-paper',
  // The ring is opt-OUT (see the `ring` prop): an inverse stamp nested inside a
  // container that already draws an ink border would otherwise double-border.
  inverse: 'bg-paper text-ink',
  'on-tone': 'bg-transparent text-ink',
}

/** The rounded chip (default): a keyword / status / action-economy stamp-chip. */
type BadgeChipProps = {
  children: ReactNode
  /** Rounded chip (default). */
  shape?: 'chip'
  /**
   * The chip material:
   * - `solid` (default) — ink block, paper text (the keyword).
   * - `ghost` — paper block, ink text, inset ink ring (inverted keyword).
   * - `outline` — 2px ink outline on paper (the default Pill).
   * - `tone` — a tone-filled Pill (pass `tone`).
   * - `quiet` — borderless, muted ground (the quiet keyword chip).
   */
  surface?: BadgeSurface
  /** Tone fill for `surface="tone"`. */
  tone?: BadgeTone
  className?: string
}

/**
 * The SQUARE stamp (`shape="stamp"`): the one ink label/header/tab/eyebrow atom
 * (ruleset §5, atom 1). Square (no radius), condensed-bold uppercase, line-height
 * 1, `tracking-caps-tight`; adds the `size` / `surface` / `seam` axes. The visual
 * is shared with `Text variant="pseudoheader"`.
 */
type BadgeStampProps = {
  children: ReactNode
  shape: 'stamp'
  /** Text scale on the FULL / COMPACT / MINI ladder. `compact` is the default. */
  size?: StampSize
  /**
   * The plate the stamp sits on:
   * - `on-ink` (default) — ink block, white text: the canonical label/header.
   * - `inverse` — paper block, ink text, inset ink ring (see `ring`).
   * - `on-tone` — no fill, ink text: a stamp sitting directly on a tone surface.
   */
  surface?: StampSurface
  /**
   * Ride the container's top border (StampSeam). Give the container `relative`;
   * pass the horizontal inset via `className` (e.g. `left-3`).
   */
  seam?: boolean
  /**
   * Override the baked-in `line-height: 1`. The stamp forces line-height 1 for
   * crisp single-line labels/tabs; pass a Tailwind leading utility (e.g.
   * `leading-[1.28]`) when the stamp is a wrapping display headline that needs
   * breathing room between lines.
   */
  leading?: string
  /**
   * Draw the inset ink ring on `surface="inverse"` (default `true`).
   *
   * Pass `false` when the stamp sits inside a container that already draws an
   * ink border — a horizontal Stat value cell, a SectionSeparator — where the
   * ring reads as a double border. This is also the un-ringed inverse that
   * `Text variant="pseudoheaderInverse"` renders, so those sites can migrate.
   */
  ring?: boolean
  as?: ElementType
  className?: string
} & Omit<HTMLAttributes<HTMLElement>, 'children' | 'className'>

type BadgeProps = BadgeChipProps | BadgeStampProps

/**
 * Badge — the one label-chip atom (ruleset §5 atom 3, §6 merge map). Two shapes:
 *
 *   `shape="chip"` (default) — the rounded 22px keyword / status chip; `surface`
 *                              picks solid / ghost / outline / tone / quiet.
 *   `shape="stamp"`          — the SQUARE ink label / header / tab (the former
 *                              Stamp); `size` + stamp `surface` + `seam`.
 *
 * **Label-only.** A badge cites categorical metadata at a glance. **A label+value
 * readout is NOT a badge** — it is a Stat (`Stat orientation="horizontal"`), the
 * value-cell law (ruleset §0, §7.1). Pill and Chip were named presets over the
 * chip shape.
 */
/**
 * Ref-forwarding is load-bearing, not boilerplate: Stat measures its own label
 * stamps to drive the overflow `scaleX` squeeze, so a stamp that swallowed its
 * ref would silently kill that feature.
 */
export const Badge = forwardRef<HTMLElement, BadgeProps>(function Badge(props, ref) {
  if (props.shape === 'stamp') {
    const {
      children,
      size = DEFAULT_RUNG,
      surface = 'on-ink',
      seam = false,
      leading,
      ring = true,
      as: Tag = 'span',
      className,
      shape: _shape,
      style,
      ...rest
    } = props
    return (
      <Tag
        ref={ref}
        className={cn(
          'inline-block w-fit font-cond font-bold uppercase tracking-caps-tight',
          leading ?? 'leading-none',
          STAMP_SIZE[size],
          STAMP_SURFACE[surface],
          surface === 'inverse' && ring && 'ring-1 ring-inset ring-ink',
          seam && STAMP_SEAM,
          className
        )}
        // The stamp bakes in line-height:1 for crisp single-line labels; a
        // `leading` override (e.g. a wrapping display headline) opts out of it.
        style={leading ? style : { lineHeight: 1, ...style }}
        {...rest}
      >
        {children}
      </Tag>
    )
  }
  const { children, surface = 'solid', tone, className } = props
  return (
    <span
      ref={ref as React.Ref<HTMLSpanElement>}
      className={cn(
        'inline-flex h-[22px] items-center rounded-badge font-cond text-badge font-semibold uppercase leading-none',
        BADGE_SURFACE[surface],
        surface === 'tone' && tone && BADGE_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  )
})
