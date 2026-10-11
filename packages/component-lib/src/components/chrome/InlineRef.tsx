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
 * InlineRef — an in-prose entity reference or link (ruleset §"Inline reference /
 * link"). Every prose link in either app is one: with `Button`, this is the
 * only thing allowed to paint rust (ruleset §3.1, `tokens/rust-allowlist`).
 *
 * A word inside body text that reads its state from `href` presence:
 * - **Navigable** (`href` set) — a rust border-bottom; navigates via a real
 *   `<a href>`, so it is keyboard-reachable (the one rust element allowed in
 *   read-only prose, ruleset §3.1).
 * - **Inert** (no `href`) — an ink **dashed** border-bottom with `cursor-help`;
 *   it only summons the tooltip.
 *
 * The distinguishing rule is the border + navigability; a richer hovercard is a
 * composition concern (wrap in `Tooltip` / `EntityTooltip`). The word keeps
 * its prose's own type and colour, so a reference reads on any ground — paper
 * prose, an ink roll band, a tone header (`.su-inline-ref` in `index.css`).
 */
export function InlineRef({ children, href, title, className, ...rest }: InlineRefProps) {
  if (href) {
    return (
      <a
        href={href}
        title={title}
        className={cn('su-inline-ref su-inline-ref--link', className)}
        {...rest}
      >
        {children}
      </a>
    )
  }

  return (
    <span title={title} className={cn('su-inline-ref su-inline-ref--inert', className)}>
      {children}
    </span>
  )
}
