import type { ElementType, HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { STAMP_SEAM } from './stampSeam'

export type BadgeTone = 'pilot' | 'mech' | 'crawler' | 'ok' | 'warn' | 'bad'
/** Chip surfaces (the rounded `shape="chip"` default). */
export type BadgeSurface = 'solid' | 'ghost' | 'outline' | 'tone' | 'quiet'
/** Stamp text scale (`shape="stamp"`). */
export type StampSize = 'sm' | 'md' | 'lg'
/** Stamp plate (`shape="stamp"`). */
export type StampSurface = 'on-ink' | 'inverse' | 'on-tone'

/** Tone fills for `surface="tone"` — kind fills frame in ink, status fills self-border. */
const BADGE_TONES: Record<BadgeTone, string> = {
  pilot: 'border-ink bg-su-orange text-ink',
  mech: 'border-ink bg-su-green text-ink',
  crawler: 'border-ink bg-su-pink text-paper',
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

/** Stamp text scale — px/py + text size. `md` is the label/header default. */
const STAMP_SIZE: Record<StampSize, string> = {
  sm: 'px-1 py-0.5 text-badge',
  md: 'px-1.5 py-0.5 text-xs',
  lg: 'px-2 py-1 text-sm',
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
   * - `quiet` — borderless, muted ground (the Chip).
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
  /** Text scale. `md` (default) is the label/header size. */
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
 * value-cell law (ruleset §0, §7.1). `Pill` and `Chip` are named presets over the
 * chip shape.
 */
export function Badge(props: BadgeProps) {
  if (props.shape === 'stamp') {
    const {
      children,
      size = 'md',
      surface = 'on-ink',
      seam = false,
      as: Tag = 'span',
      className,
      shape: _shape,
      ...rest
    } = props
    return (
      <Tag
        className={cn(
          'inline-block w-fit font-cond font-bold uppercase leading-none tracking-caps-tight',
          STAMP_SIZE[size],
          STAMP_SURFACE[surface],
          seam && STAMP_SEAM,
          className
        )}
        style={{ lineHeight: 1 }}
        {...rest}
      >
        {children}
      </Tag>
    )
  }
  const { children, surface = 'solid', tone, className } = props
  return (
    <span
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
}
