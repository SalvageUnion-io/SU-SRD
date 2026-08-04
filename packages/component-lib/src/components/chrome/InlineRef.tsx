import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../utils/cn'

type InlineRefProps = {
  children: ReactNode
  /**
   * Destination for a resolved, navigable reference. Present → a real `<a>`
   * (rust border, keyboard-reachable); absent → an inert prose mark (ink
   * dashed border) that only summons a tooltip.
   */
  href?: string
  /** Native tooltip text (the glance). */
  title?: string
  className?: string
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'title' | 'className' | 'children'>

/**
 * InlineRef — an in-prose entity reference (ruleset §"Inline reference / link").
 *
 * A word inside body text that reads its state from `href` presence:
 * - **Navigable** (`href` set) — a rust border-bottom; navigates via a real
 *   `<a href>`, so it is keyboard-reachable (the one rust element allowed in
 *   read-only prose, ruleset §3.1).
 * - **Inert** (no `href`) — an ink **dashed** border-bottom with `cursor-help`;
 *   it only summons the tooltip.
 *
 * The distinguishing rule is the border + navigability; a richer hovercard is a
 * composition concern (wrap in `Tooltip` / `EntityTooltip`).
 */
export function InlineRef({ children, href, title, className, ...rest }: InlineRefProps) {
  const base = 'font-body underline-offset-2 border-b-chrome transition-colors duration-[120ms]'

  if (href) {
    return (
      <a
        href={href}
        title={title}
        className={cn(
          base,
          'border-rust text-ink no-underline hover:text-rust focus-visible:text-rust',
          className
        )}
        {...rest}
      >
        {children}
      </a>
    )
  }

  return (
    <span
      title={title}
      className={cn(base, 'cursor-help border-dashed border-ink-50 text-ink', className)}
    >
      {children}
    </span>
  )
}
