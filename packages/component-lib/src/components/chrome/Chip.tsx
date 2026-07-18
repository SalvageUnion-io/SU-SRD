import type { ReactNode } from 'react'
import { Badge } from './Badge'

type ChipProps = {
  children: ReactNode
  className?: string
}

/**
 * Quiet keyword / status chip — the `Badge` `quiet` preset: borderless, wk-bg-2
 * ground, fixed 22px badge height. A single keyword — a label+value readout is
 * a Stat (`Stat`), not a chip.
 */
export function Chip({ children, className }: ChipProps) {
  return (
    <Badge surface="quiet" className={className}>
      {children}
    </Badge>
  )
}
