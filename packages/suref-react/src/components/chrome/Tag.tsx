import type { ReactNode } from 'react'
import { Badge } from './Badge'

type TagProps = {
  /** Stamped chip text, e.g. "RANGE" */
  label: ReactNode
  /** Inverted ghost chip (paper bg, ink text, inset ring) for keyword /
   * action-economy tags (TURN ACTION, PASSIVE, BALLISTIC…) */
  ghost?: boolean
  className?: string
}

/**
 * Stamped keyword chip — the `Badge` `solid`/`ghost` preset (ruleset §6:
 * "a keyword Tag is a Badge with a single label cell"). Cond 600 11px
 * uppercase, ink bg / paper text. A single label — NOT split label/value.
 * Split label/value content is a Stat: render it with
 * `StatDisplay orientation="horizontal"`.
 */
export function Tag({ label, ghost = false, className }: TagProps) {
  return (
    <Badge surface={ghost ? 'ghost' : 'solid'} className={className}>
      {label}
    </Badge>
  )
}
