import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

type FilterRowProps = {
  label: string
  children: ReactNode
  /** Label sits on a dark tone band (e.g. the EntitySearcher's floating modal
   * sub-header) — switch it to paper so it stays legible instead of the
   * light-bg muted ink. */
  onDark?: boolean
}

export function FilterRow({ label, children, onDark = false }: FilterRowProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset+legend carries min-content sizing quirks in this chip row; role="group" + aria-label conveys the same semantics
    <div
      className="flex flex-col items-center gap-1 sm:flex-row sm:items-center"
      role="group"
      aria-label={`Filter by ${label}`}
    >
      <span
        className={cn(
          'font-cond text-label font-bold uppercase tracking-caps-snug sm:w-[4.5rem] sm:shrink-0 sm:text-right',
          onDark ? 'text-paper/85' : 'text-ink/40'
        )}
      >
        {label}
      </span>
      <div className="flex flex-wrap justify-center gap-1 sm:justify-start">{children}</div>
    </div>
  )
}
