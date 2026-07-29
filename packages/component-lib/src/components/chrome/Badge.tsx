import { forwardRef } from 'react'
import type { ElementType, HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { FOCUS_RING } from './interaction'
import { STAMP_SEAM } from './stampSeam'
import { DEFAULT_RUNG, RUNG_INLINE_PADDING, RUNG_TYPE, type SizeRung } from '../../styles/sizing'

export type BadgeTone = 'pilot' | 'mech' | 'crawler' | 'game' | 'ok' | 'warn' | 'bad'
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
  // Light enough for dark ink, like pilot and mech — crawler is the dark one.
  game: 'border-ink bg-sheet-game text-ink',
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
  inverse: 'bg-paper text-ink ring-1 ring-inset ring-ink',
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
  /**
   * Optional leading 14×14 colour swatch (an inline CSS `background` value, e.g.
   * `var(--color-tl-1)`) rendered before the label. This is the tech-level
   * filter-chip rung — a swatch-prefixed chip, no longer its own component.
   */
  swatch?: string
  /**
   * Render as a different element. The chip's escape hatch is interactivity:
   * `as="button"` turns the chip into a toggle. When overridden the chip gains
   * `cursor-pointer` + the shared rust focus ring, and a `button` defaults to
   * `type="button"`. The call site owns the toggle state — drive `surface`
   * (`solid` when pressed / `ghost` when not) and pass `aria-pressed` yourself,
   * so the Badge stays presentational.
   */
  as?: ElementType
  className?: string
} & Omit<HTMLAttributes<HTMLElement>, 'children' | 'className'>

/**
 * The SQUARE stamp (`shape="stamp"`): the one ink label/header/tab/eyebrow atom
 * (ruleset §5, atom 1). Square (no radius), condensed-bold uppercase, line-height
 * 1, `tracking-caps-tight`; adds the `size` / `surface` / `seam` axes. This is
 * the SOLE implementation of the ink stamp — `Text`'s `pseudoheader` /
 * `pseudoheaderInverse` variants rendered the same plate and were retired onto
 * it (ruleset §0: one kind × one context = one primitive).
 */
type BadgeStampProps = {
  children: ReactNode
  shape: 'stamp'
  /** Text scale on the FULL / COMPACT / MINI ladder. `compact` is the default. */
  size?: StampSize
  /**
   * The plate the stamp sits on:
   * - `on-ink` (default) — ink block, white text: the canonical label/header.
   * - `inverse` — paper block, ink text, inset ink ring.
   * - `on-tone` — no fill, ink text: a stamp sitting directly on a tone surface.
   */
  surface?: StampSurface
  /**
   * Ride the container's top border (StampSeam). Give the container `relative`;
   * pass the horizontal inset via `className` (e.g. `left-3`).
   */
  seam?: boolean
  /**
   * Override the baked-in `leading-none`. The stamp forces line-height 1 for
   * crisp single-line labels/tabs; pass a Tailwind leading utility (e.g.
   * `leading-[1.28]`) when the stamp is a wrapping display headline that needs
   * breathing room between lines.
   */
  leading?: string
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
          // The stamp bakes in line-height:1 for crisp single-line labels; a
          // `leading` override (e.g. a wrapping display headline) opts out.
          leading ?? 'leading-none',
          STAMP_SIZE[size],
          STAMP_SURFACE[surface],
          seam && STAMP_SEAM,
          className
        )}
        style={style}
        {...rest}
      >
        {children}
      </Tag>
    )
  }
  const {
    children,
    surface = 'solid',
    tone,
    swatch,
    as: Tag = 'span',
    className,
    shape: _shape,
    ...rest
  } = props
  const interactive = Tag !== 'span'
  return (
    <Tag
      ref={ref}
      {...(Tag === 'button' ? { type: 'button' } : {})}
      className={cn(
        'inline-flex h-[22px] items-center rounded-badge font-cond text-badge font-semibold uppercase leading-none',
        swatch != null && 'gap-1.5',
        interactive && cn('cursor-pointer', FOCUS_RING),
        BADGE_SURFACE[surface],
        surface === 'tone' && tone && BADGE_TONES[tone],
        className
      )}
      {...rest}
    >
      {swatch != null && (
        <i
          aria-hidden="true"
          className="block h-3.5 w-3.5 shrink-0 rounded-pip border border-ink"
          style={{ background: swatch }}
        />
      )}
      {children}
    </Tag>
  )
})
