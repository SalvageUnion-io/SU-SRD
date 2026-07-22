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
   */
  variant?: 'heading' | 'subheading'
  /** Element override. Defaults to `h1` for `heading`, `h2` for `subheading`. */
  as?: ElementType
  className?: string
}

/**
 * PageHeading — the page-level heading language promoted from srd's per-app
 * `.page-heading` / `.page-subheading`. `heading` is the ink stamp band; the
 * `subheading` variant is the quieter condensed-caps section head. Per-page
 * modifiers (e.g. `text-center`, `mb-2`) still ride alongside via `className`.
 */
export function PageHeading({ children, variant = 'heading', as, className }: PageHeadingProps) {
  const Tag = as ?? (variant === 'subheading' ? 'h2' : 'h1')
  return (
    <Tag
      className={cn(
        variant === 'subheading'
          ? 'font-cond text-lg font-bold uppercase'
          : // The former `.page-heading` set an off-ladder `letter-spacing: 0.01em`
            // (~0.3px at this display size — imperceptible, and below the tracking
            // ladder's tightest rung). Promoting it onto the library snaps it to the
            // default spacing to stay on-system (ruleset §4.2, tokens-only tracking).
            'box-decoration-clone bg-ink px-2 py-1 font-cond text-3xl/[1] font-bold uppercase text-paper',
        className
      )}
    >
      {children}
    </Tag>
  )
}
