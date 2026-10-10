import type { ElementType, ReactNode, Ref } from 'react'
import { cn } from '../../utils/cn'

type PageHeadingProps = {
  children: ReactNode
  /**
   * `subheading` (default) — the plain condensed-caps section subheading
   * (former `.page-subheading`, the page H2s); keeps `text-lg`'s 1.75rem
   * line-height.
   * `section` — the quietest rung: the in-panel section head a card or a
   * live-sheet region wears above a list. It exists because the apps had
   * fifteen hand-rolled `font-cond … uppercase` headings at five different
   * sizes, and the rungs above could only absorb the largest of them;
   * without this one the smallest simply stayed hand-rolled. It emits NO text
   * colour, so a section head that needs one (a Game roster group's tone)
   * passes it through `className` instead of forking the rung. Never rust:
   * rust is an action's colour (ruleset §3.1).
   */
  variant?: 'subheading' | 'section'
  /** Element override. Defaults to `h2`. */
  as?: ElementType
  className?: string
  /** For a region that names itself by its heading (`aria-labelledby`). */
  id?: string
  /**
   * `-1` makes the heading a programmatic focus target — where focus lands
   * when the thing it was on disappears (EntitySearcher's selection rail, after
   * its last entry is removed). Never `0`: a heading is not a tab stop.
   */
  tabIndex?: -1
  ref?: Ref<HTMLHeadingElement>
}

/**
 * PageHeading — the in-page heading rungs promoted from srd's per-app
 * `.page-subheading`: the condensed-caps subheading and the quieter section
 * head. The page's own title is not one of them: that is the `ChapterBand`,
 * which replaced this component's former ink-stamp `heading` rung (brand refresh P2a).
 * Per-page modifiers (e.g. `text-center`, `mb-2`) ride alongside via
 * `className`.
 */
/** The two rungs, spelled once so the variant switch stays a lookup. */
const HEADING_VARIANTS = {
  subheading: 'font-cond text-lg font-bold uppercase',
  section: 'font-cond text-sm font-bold uppercase tracking-caps',
} as const

export function PageHeading({
  children,
  variant = 'subheading',
  as,
  className,
  id,
  tabIndex,
  ref,
}: PageHeadingProps) {
  const Tag = as ?? 'h2'
  return (
    <Tag ref={ref} id={id} tabIndex={tabIndex} className={cn(HEADING_VARIANTS[variant], className)}>
      {children}
    </Tag>
  )
}
