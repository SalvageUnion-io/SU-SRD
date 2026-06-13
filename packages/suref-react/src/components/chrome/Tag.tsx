import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

type TagProps = {
  /** Stamped chip text, e.g. "RANGE" */
  label: ReactNode
  /** Inverted value box, e.g. "[CLOSE]" in `RANGE [CLOSE]` */
  value?: ReactNode
  /** Put the value before the label (`[1] AP`) */
  pre?: boolean
  /** Inverted ghost chip (paper bg, ink text, inset ring) for keyword /
   * action-economy tags (TURN ACTION, PASSIVE, BALLISTIC…) */
  ghost?: boolean
  className?: string
}

/**
 * Stamped chip (design-spec §2.2 `.tag`): cond 600 11px uppercase, ink bg /
 * paper text. The value form inverts the value box; `ghost` inverts the whole
 * chip and flips the value box back to ink-on-paper.
 */
export function Tag({ label, value, pre = false, ghost = false, className }: TagProps) {
  const valueNode =
    value != null ? (
      <b
        className={cn(
          'px-1 font-body font-bold normal-case',
          ghost ? 'bg-ink text-paper' : 'bg-paper text-ink'
        )}
      >
        {value}
      </b>
    ) : null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[2px] px-[7px] pb-[1px] pt-[2px] font-cond text-[11px] font-semibold uppercase leading-tight tracking-[0.06em]',
        ghost
          ? 'bg-paper text-ink shadow-[inset_0_0_0_1px_rgba(40,32,25,0.2)]'
          : 'bg-ink text-paper',
        className
      )}
    >
      {pre && valueNode}
      <span>{label}</span>
      {!pre && valueNode}
    </span>
  )
}
