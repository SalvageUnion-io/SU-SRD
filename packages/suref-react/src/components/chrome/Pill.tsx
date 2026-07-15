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
  className?: string
}

/**
 * Pill badge (design-spec §2.6 `.pill`): 2px border, 2px radius, uppercase
 * cond 11px, fixed 22px badge height. Kind fills pilot/mech/crawler; status
 * fills ok/warn/bad.
 */
export function Pill({ children, tone, className }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center rounded-[2px] border-2 px-[9px] font-cond text-[11px] font-semibold uppercase leading-none tracking-wider',
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
  className?: string
}

/**
 * Quiet keyword / status chip (design-spec §2.6 `.chip`): borderless, wk-bg-2
 * ground, fixed 22px badge height. A single keyword — a label+value readout is
 * a Stat (`StatDisplay`), not a chip.
 */
export function Chip({ children, className }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center rounded-[2px] bg-wk-bg-2 px-2 font-cond text-[11px] font-semibold uppercase leading-none text-ink-2',
        className
      )}
    >
      {children}
    </span>
  )
}
