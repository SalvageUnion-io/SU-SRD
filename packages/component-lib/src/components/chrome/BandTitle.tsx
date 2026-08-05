import type { ElementType, ReactNode } from 'react'
import { cn } from '../../utils/cn'

/**
 * The paper-on-tone title that sits in a `Card`'s header band.
 *
 * ## Why this is not `Badge shape="stamp"`
 *
 * It looks like a stamp — condensed caps, paper on a toned ground — and the
 * obvious cleanup is to make it one. It is not, and the difference is not
 * cosmetic: **a stamp is intrinsically sized.** `w-fit` is what a stamp IS; it
 * is a plate cut to its text, which is what lets it ride a seam and sit at any
 * width without stretching. A band title is the opposite: it takes its width
 * from the band's flex track (`min-w-0 flex-1`) and truncates when the title
 * outgrows it, because the band also has to hold the controls next to it.
 *
 * Adding a truncating rung to the stamp would have made "sizes to its content"
 * conditional, and that invariant is load-bearing everywhere else the stamp is
 * used. So this is a separate atom, as ruleset §5 means the word — a different
 * KIND, not a variant.
 *
 * (The `mute` tone is the same title one step back, for a secondary band label:
 * `text-paper/60` at the small rung.)
 */
export type BandTitleProps = {
  children: ReactNode
  /** `lead` — the band's primary title. `mute` — a secondary label beside it. */
  variant?: 'lead' | 'mute'
  /**
   * Take the band's remaining width and truncate. On by default, because that
   * is the whole reason this exists; pass `false` for a title that shares the
   * track with another flexing element.
   */
  fill?: boolean
  as?: ElementType
  className?: string
}

const VARIANT = {
  lead: 'text-lg leading-none tracking-caps-tight text-paper',
  mute: 'text-xs text-paper/60',
} as const

export function BandTitle({
  children,
  variant = 'lead',
  fill = true,
  as: Tag = 'span',
  className,
}: BandTitleProps) {
  return (
    <Tag
      className={cn(
        'truncate font-cond font-bold uppercase',
        fill && 'min-w-0 flex-1',
        VARIANT[variant],
        className
      )}
    >
      {children}
    </Tag>
  )
}
