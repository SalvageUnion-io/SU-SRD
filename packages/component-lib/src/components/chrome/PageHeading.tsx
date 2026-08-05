import type { ElementType, ReactNode } from 'react'
import { cn } from '../../utils/cn'

type PageHeadingProps = {
  children: ReactNode
  /**
   * `heading` (default) — the ink stamp band: white condensed-caps on an ink
   * ground, box-decoration cloned so a wrapped heading keeps its band per line
   * (srd's former `.page-heading`, the page H1).
   * `subheading` — the plain condensed-caps section subheading (former
   * `.page-subheading`, the page H2s); keeps `text-lg`'s 1.75rem line-height.
   * `section` — the quietest rung: the in-panel section head a card or a
   * live-sheet region wears above a list. It exists because the apps had
   * fifteen hand-rolled `font-cond … uppercase` headings at five different
   * sizes, and the two rungs above could only absorb the largest of them;
   * without this one the smallest simply stayed hand-rolled. It emits NO text
   * colour, so a section head that is deliberately rust (a Game roster group)
   * passes `text-rust` through `className` instead of forking the rung.
   */
  variant?: 'heading' | 'subheading' | 'section'
  /**
   * Element override. Defaults to `h1` for `heading`, `h2` for `subheading`
   * and `section`.
   */
  as?: ElementType
  className?: string
}

/**
 * PageHeading — the page-level heading language promoted from srd's per-app
 * `.page-heading` / `.page-subheading`. `heading` is the ink stamp band; the
 * `subheading` variant is the quieter condensed-caps section head. Per-page
 * modifiers (e.g. `text-center`, `mb-2`) still ride alongside via `className`.
 */
/** The three rungs, spelled once so the variant switch stays a lookup. */
const HEADING_VARIANTS = {
  // The former `.page-heading` set an off-ladder `letter-spacing: 0.01em`
  // (~0.3px at this display size — imperceptible, and below the tracking
  // ladder's tightest rung). Promoting it onto the library snaps it to the
  // default spacing to stay on-system (ruleset §4.2, tokens-only tracking).
  heading:
    'box-decoration-clone bg-ink px-2 py-1 font-cond text-3xl/[1] font-bold uppercase text-paper',
  subheading: 'font-cond text-lg font-bold uppercase',
  section: 'font-cond text-sm font-bold uppercase tracking-caps',
} as const

export function PageHeading({ children, variant = 'heading', as, className }: PageHeadingProps) {
  const Tag = as ?? (variant === 'heading' ? 'h1' : 'h2')
  return <Tag className={cn(HEADING_VARIANTS[variant], className)}>{children}</Tag>
}
