import type { CSSProperties, ReactNode } from 'react'
import { color, fontSize, tracking } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { capsLabel } from './capsLabel'

/**
 * The paper-on-tone title that sits in a `Card`'s header band.
 *
 * ## Why this is not `Badge shape="stamp"`
 *
 * It looks like a stamp — condensed caps, paper on a toned ground — and the
 * obvious cleanup is to make it one. It is not, and the difference is not
 * cosmetic: **a stamp is intrinsically sized.** `w-fit` is what a stamp IS; it
 * is a plate cut to its text, which is what lets it ride a seam and sit at any
 * width without stretching. A band title is the opposite: it truncates with
 * "…" when the band is narrower than the title (a caller bounds it, e.g. with
 * `max-width`), because the band also has to hold what sits next to it.
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
  className?: string
}

/** Condensed bold caps that truncate rather than wrap. */
const BASE = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties
const BASE_CAPS = capsLabel()

const VARIANT = {
  lead: {
    color: color.paper,
    fontSize: fontSize.lg,
    letterSpacing: tracking.capsTight,
    lineHeight: 1,
  },
  // The inherited `xs` rung keeps the line-height it has always been paired with.
  mute: { color: color.paper60, fontSize: fontSize.xs, lineHeight: 'calc(1 / 0.75)' },
} as const satisfies Record<string, CSSProperties>

export function BandTitle({ children, variant = 'lead', className }: BandTitleProps) {
  return (
    <span className={cn(BASE_CAPS, className)} style={{ ...BASE, ...VARIANT[variant] }}>
      {children}
    </span>
  )
}
