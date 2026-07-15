import type { ReactNode } from 'react'
import { Badge } from './Badge'

export type PillTone = 'pilot' | 'mech' | 'crawler' | 'ok' | 'warn' | 'bad'

type PillProps = {
  children: ReactNode
  /** Entity-kind or status fill; default is ink-on-paper outline */
  tone?: PillTone
  className?: string
}

/**
 * Pill badge — the `Badge` `tone`/`outline` preset (ruleset §6: "a Pill is a
 * Badge with a tone surface"). 2px border, fixed 22px badge height. Kind fills
 * pilot/mech/crawler; status fills ok/warn/bad; default is the ink outline.
 */
export function Pill({ children, tone, className }: PillProps) {
  return (
    <Badge surface={tone ? 'tone' : 'outline'} tone={tone} className={className}>
      {children}
    </Badge>
  )
}

type ChipProps = {
  children: ReactNode
  className?: string
}

/**
 * Quiet keyword / status chip — the `Badge` `quiet` preset: borderless, wk-bg-2
 * ground, fixed 22px badge height. A single keyword — a label+value readout is
 * a Stat (`StatDisplay`), not a chip.
 */
export function Chip({ children, className }: ChipProps) {
  return (
    <Badge surface="quiet" className={className}>
      {children}
    </Badge>
  )
}
