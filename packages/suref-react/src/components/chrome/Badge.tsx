import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

export type BadgeTone = 'pilot' | 'mech' | 'crawler' | 'ok' | 'warn' | 'bad'
export type BadgeSurface = 'solid' | 'ghost' | 'outline' | 'tone' | 'quiet'

/** Tone fills for `surface="tone"` — kind fills frame in ink, status fills self-border. */
const BADGE_TONES: Record<BadgeTone, string> = {
  pilot: 'border-ink bg-su-orange text-ink',
  mech: 'border-ink bg-su-green text-ink',
  crawler: 'border-ink bg-su-pink text-su-white',
  ok: 'border-status-ok bg-status-ok text-su-white',
  warn: 'border-status-warn bg-status-warn text-su-white',
  bad: 'border-status-bad bg-status-bad text-su-white',
}

/** Per-surface geometry — every badge is a fixed 22px, rounded-[2px] stamp-chip. */
const BADGE_SURFACE: Record<BadgeSurface, string> = {
  solid: 'px-[7px] bg-ink text-paper tracking-caps-snug',
  ghost:
    'px-[7px] bg-paper text-ink shadow-[inset_0_0_0_1px_rgba(40,32,25,0.2)] tracking-caps-snug',
  outline: 'px-[9px] border-2 border-ink bg-paper text-ink tracking-wider',
  tone: 'px-[9px] border-2 tracking-wider',
  quiet: 'px-2 bg-wk-bg-2 text-ink-2',
}

type BadgeProps = {
  children: ReactNode
  /**
   * The badge material:
   * - `solid` (default) — ink block, paper text (the keyword Tag).
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
 * Badge — the stamp-chip family, unified (ruleset §5 atom 3, §6 merge map).
 *
 * **Label-only.** A badge cites categorical metadata at a glance: a keyword, a
 * status, an action-economy tag. **A label+value readout is NOT a badge** — it
 * is a Stat (`StatDisplay orientation="horizontal"`), the value-cell law
 * (ruleset §0, §7.1). Every badge shares one height (22px), one radius (2px),
 * and the condensed-uppercase stamp type; only `surface`/`tone` vary.
 *
 * `Tag`, `Pill`, and `Chip` are named presets over this one implementation.
 */
export function Badge({ children, surface = 'solid', tone, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center rounded-[2px] font-cond text-[11px] font-semibold uppercase leading-none',
        BADGE_SURFACE[surface],
        surface === 'tone' && tone && BADGE_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
