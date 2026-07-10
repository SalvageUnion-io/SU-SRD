import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

export type PillTone = 'pilot' | 'mech' | 'crawler' | 'ok' | 'warn' | 'bad'

const PILL_TONES: Record<PillTone, string> = {
  // Entity-kind fills (ink border, ink text except crawler)
  pilot: 'border-ink bg-su-orange text-ink',
  mech: 'border-ink bg-su-green text-ink',
  crawler: 'border-ink bg-su-pink text-su-white',
  // Status fills (border matches fill, white text)
  ok: 'border-status-ok bg-status-ok text-su-white',
  warn: 'border-status-warn bg-status-warn text-su-white',
  bad: 'border-status-bad bg-status-bad text-su-white',
}

type PillProps = {
  children: ReactNode
  /** Entity-kind or status fill; default is ink-on-paper outline */
  tone?: PillTone
  /**
   * Full pill shape (radius 999) — the poster app-bar "kindpill" (design
   * source clean-pilot.html `.kindpill`). Default false keeps the existing
   * 2px-radius badge shape used everywhere else.
   */
  rounded?: boolean
  className?: string
}

/**
 * Pill badge (design-spec §2.6 `.pill`): 2px border, 2px radius, uppercase
 * cond 11px. Kind fills pilot/mech/crawler; status fills ok/warn/bad.
 */
export function Pill({ children, tone, rounded, className }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center border-2 px-[9px] py-[3px] font-cond text-[11px] font-semibold uppercase leading-none tracking-[0.05em]',
        rounded ? 'rounded-full' : 'rounded-[2px]',
        tone ? PILL_TONES[tone] : 'border-ink bg-paper text-ink',
        className
      )}
    >
      {children}
    </span>
  )
}

type ChipProps = {
  children: ReactNode
  /** Bold inverse-emphasis value, rendered after the label */
  value?: ReactNode
  className?: string
}

/**
 * Quiet stat chip (design-spec §2.6 `.chip`): borderless, wk-bg-2 ground —
 * used for pick-card stats, conditions summaries, cargo summaries.
 */
export function Chip({ children, value, className }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[2px] bg-wk-bg-2 px-2 py-[2px] font-cond text-[11px] font-semibold uppercase leading-tight text-ink-2',
        className
      )}
    >
      {children}
      {value != null && <b className="font-body font-bold normal-case">{value}</b>}
    </span>
  )
}
