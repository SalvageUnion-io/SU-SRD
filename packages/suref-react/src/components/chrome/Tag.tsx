import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

type TagProps = {
  /** Stamped chip text, e.g. "RANGE" */
  label: ReactNode
  /** Inverted ghost chip (paper bg, ink text, inset ring) for keyword /
   * action-economy tags (TURN ACTION, PASSIVE, BALLISTIC…) */
  ghost?: boolean
  className?: string
}

/**
 * Stamped keyword chip (design-spec §2.2 `.tag`): cond 600 11px uppercase, ink
 * bg / paper text. A single label — NOT split label/value. Split label/value
 * content is a Stat: render it with `StatDisplay orientation="horizontal"`.
 * `ghost` inverts the chip (paper bg, ink text) for keyword / action-economy tags.
 */
export function Tag({ label, ghost = false, className }: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center rounded-[2px] px-[7px] font-cond text-[11px] font-semibold uppercase leading-none tracking-caps-snug',
        ghost
          ? 'bg-paper text-ink shadow-[inset_0_0_0_1px_rgba(40,32,25,0.2)]'
          : 'bg-ink text-paper',
        className
      )}
    >
      {label}
    </span>
  )
}
