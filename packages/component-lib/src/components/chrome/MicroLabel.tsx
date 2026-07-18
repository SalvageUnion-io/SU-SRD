import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

type MicroLabelProps = {
  children: ReactNode
  /** Text tone. `muted` (default) / `rust` (a live count) / `ink`. */
  tone?: 'muted' | 'rust' | 'ink'
  className?: string
  /** Test hook forwarded to the span. */
  'data-testid'?: string
}

/**
 * MicroLabel — a stamp-voice inline caption (`font-cond` bold uppercase,
 * `tracking-caps`): the tiny status/count labels like "Copy 2 of 3" or
 * "1 Installed" that sit under an entity card. NOT a Badge (no plate/fill) —
 * it's plain tinted text, so it stays subordinate to the content it annotates.
 * Legacy-tier: consolidates the hand-rolled stamp-voice `<span>`s the wizard
 * and sheets each inlined; size overrides ride `className` (default `text-label`).
 */
export function MicroLabel({
  children,
  tone = 'muted',
  className,
  'data-testid': testId,
}: MicroLabelProps) {
  return (
    <span
      data-testid={testId}
      className={cn(
        'font-cond text-label font-bold uppercase leading-none tracking-caps',
        tone === 'rust' ? 'text-rust' : tone === 'ink' ? 'text-ink' : 'text-wk-muted',
        className
      )}
    >
      {children}
    </span>
  )
}
