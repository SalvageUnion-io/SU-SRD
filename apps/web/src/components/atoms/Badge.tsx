import type { CSSProperties, ElementType, HTMLAttributes, ReactNode, Ref } from 'react'
import { borderWidth, color, radius, space } from '../../design/tokens'
import { cn } from '../../lib/cn'
import type { SizeRung } from '../../styles/sizing'
import { DEFAULT_RUNG, RUNG_INLINE_PADDING, RUNG_TYPE } from '../../styles/sizing'
import { capsLabel } from './capsLabel'
import { FOCUS_RING } from './interaction'
import { STAMP_SEAM } from './stampSeam'

export type BadgeTone = 'pilot' | 'mech' | 'crawler' | 'game' | 'ok' | 'warn' | 'bad'
/** Chip surfaces (the rounded `shape="chip"` default). */
type BadgeSurface = 'solid' | 'ghost' | 'outline' | 'tone' | 'quiet'
/**
 * Stamp text scale — the canonical FULL / COMPACT / MINI ladder (see
 * `src/styles/sizing.ts`). Badge is the reference
 * implementation of that vocabulary: every three-step size axis in the system
 * uses these names, so a size means the same thing wherever it is read.
 */
type StampSize = SizeRung
/** Stamp plate (`shape="stamp"`). */
export type StampSurface = 'on-ink' | 'inverse' | 'dashed'

/*
 * Every chip and stamp property lives in a `.su-badge*` class (`styles/index.css`),
 * not a style object, although none of them has a stateful variant. Badge is the
 * most-overridden atom in the system: call sites restyle padding, display, size,
 * tracking, colour and the inset ring through `className`, and a caller's utility
 * only beats the base while the base is a stylesheet rule — an inline style would
 * silently win over every one of those overrides.
 */

/** Tone fills for `surface="tone"` — kind fills frame in ink, status fills self-border. */
const BADGE_TONES: Record<BadgeTone, string> = {
  pilot: 'su-badge--tone-pilot',
  mech: 'su-badge--tone-mech',
  // Paper on the deeper crawler band (4.6 : 1, ruleset §3.8): plain crawler pink
  // carries neither paper (3.7) nor ink (4.2) at 4.5 : 1.
  crawler: 'su-badge--tone-crawler',
  // Light enough for dark ink, like pilot and mech — crawler is the dark one.
  game: 'su-badge--tone-game',
  ok: 'su-badge--tone-ok',
  warn: 'su-badge--tone-warn',
  bad: 'su-badge--tone-bad',
}

/** Per-surface geometry — every chip is a fixed 22px, rounded-badge stamp-chip. */
const BADGE_SURFACE: Record<BadgeSurface, string> = {
  solid: 'su-badge--solid',
  ghost: 'su-badge--ghost',
  outline: 'su-badge--outline',
  tone: 'su-badge--tone',
  // Its ground is a style object (`QUIET_GROUND`): nothing on a chip changes it.
  quiet: 'su-badge--quiet',
}

/**
 * The quiet chip's ground: the workshop step off paper (ruleset §4.1). It was
 * the cool `wk-bg-2` until the brand refresh warmed the page; the `cool-ground`
 * token rule keeps that tone out.
 */
const QUIET_GROUND = { backgroundColor: color.wkBg } satisfies CSSProperties

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
  'on-ink': 'su-badge--on-ink',
  inverse: 'su-badge--inverse',
  dashed: 'su-badge--dashed',
}

/** The tech-level swatch: a 14px ink-ruled square before the label. */
const SWATCH = {
  borderColor: color.ink,
  borderRadius: radius.pip,
  borderStyle: 'solid',
  borderWidth: borderWidth.hairline,
  display: 'block',
  flexShrink: 0,
  height: space[14],
  width: space[14],
} satisfies CSSProperties

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
   * filter-chip rung — a swatch-prefixed chip, not its own component.
   */
  swatch?: string
  /**
   * Render as a different element. The chip's escape hatch is interactivity:
   * `as="button"` turns the chip into a toggle. When overridden the chip gains
   * a pointer cursor + the shared focus ring, and a `button` defaults to
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
 * the SOLE implementation of the ink stamp (ruleset §0: one kind × one
 * context = one primitive).
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
   * - `dashed` — paper block, ink text, a dashed ink edge: the User-made
   *   stamp (ruleset §3.9, homebrew is dashed).
   */
  surface?: StampSurface
  /**
   * Ride the container's top border (StampSeam). Give the container `relative`;
   * pass the horizontal inset via `className` (e.g. `left-3`).
   */
  seam?: boolean
  as?: ElementType
  className?: string
} & Omit<HTMLAttributes<HTMLElement>, 'children' | 'className'>

type BadgeProps = (BadgeChipProps | BadgeStampProps) & { ref?: Ref<HTMLElement> }

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
 * Accepting `ref` is load-bearing, not boilerplate: Stat measures its own label
 * stamps to drive the overflow `scaleX` squeeze, so a stamp that swallowed its
 * ref would silently kill that feature.
 */
export function Badge(props: BadgeProps) {
  if (props.shape === 'stamp') {
    const {
      children,
      size = DEFAULT_RUNG,
      surface = 'on-ink',
      seam = false,
      as: Tag = 'span',
      className,
      shape: _shape,
      style,
      ref,
      ...rest
    } = props
    return (
      <Tag
        ref={ref}
        className={cn(
          // Size comes from `STAMP_SIZE[size]`, so the recipe supplies only the
          // caps role (font-cond / uppercase / bold / caps-tight).
          capsLabel(),
          // No line-height of its own: the `leading-none` this once carried
          // sat before the rung's `text-*` size, which the old class merge let
          // win, so the line-height has always been the rung's.
          'su-badge-stamp',
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
    ref,
    style,
    ...rest
  } = props
  const interactive = Tag !== 'span'
  return (
    <Tag
      ref={ref}
      {...(Tag === 'button' ? { type: 'button' } : {})}
      className={cn(
        // Tracking is a per-SURFACE decision here (`BADGE_SURFACE` picks
        // caps-snug or caps), so the recipe inherits rather than setting it.
        capsLabel({ size: 'badge', weight: 'semibold', tracking: 'inherit' }),
        'su-badge',
        swatch != null && 'su-badge--swatch',
        // `su-hit-area`: an interactive chip stays 22px and reaches the 44px
        // coarse-pointer floor through a pseudo-element (ruleset §4.6).
        interactive && cn('su-hit-area su-badge--interactive', FOCUS_RING),
        BADGE_SURFACE[surface],
        surface === 'tone' && tone && BADGE_TONES[tone],
        className
      )}
      style={{ ...(surface === 'quiet' ? QUIET_GROUND : undefined), ...style }}
      {...rest}
    >
      {swatch != null && <i aria-hidden="true" style={{ ...SWATCH, background: swatch }} />}
      {children}
    </Tag>
  )
}
