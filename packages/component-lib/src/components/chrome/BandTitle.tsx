import type { CSSProperties, ElementType, ReactNode } from 'react'
import { color, font, fontSize, tracking, weight } from '../../design/tokens'

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
 * from the band's flex track (`flex: 1`, `min-width: 0`) and truncates when the title
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

/** Condensed bold caps that truncate rather than wrap. */
const BASE = {
  fontFamily: font.cond,
  fontWeight: weight.bold,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

/** Take the band's remaining width. */
const FILL = { flex: '1 1 0%', minWidth: 0 } satisfies CSSProperties

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

export function BandTitle({
  children,
  variant = 'lead',
  fill = true,
  as: Tag = 'span',
  className,
}: BandTitleProps) {
  return (
    <Tag
      className={className}
      style={{ ...BASE, ...(fill ? FILL : undefined), ...VARIANT[variant] }}
    >
      {children}
    </Tag>
  )
}
