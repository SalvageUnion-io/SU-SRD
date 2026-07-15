import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../utils/cn'

type InlineRefProps = {
  children: ReactNode
  /**
   * Whether the reference resolved to a known entity. Resolved refs navigate
   * (rust border, keyboard-reachable `<a>`); unresolved refs are inert prose
   * marks (ink dashed border) that only summon a tooltip.
   */
  resolved?: boolean
  /** Destination for a resolved ref. Ignored when `resolved` is false. */
  href?: string
  /** Native tooltip text (the glance). */
  title?: string
  className?: string
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'title' | 'className' | 'children'>

/**
 * InlineRef — an in-prose entity reference (ruleset §"Inline reference / link").
 *
 * A word inside body text that reads its state from resolution:
 * - **Resolved** — a rust border-bottom; navigates via a real `<a href>`, so it
 *   is keyboard-reachable (the one rust element allowed in read-only prose,
 *   ruleset §3.1).
 * - **Unresolved** — an ink **dashed** border-bottom; inert, it only summons the
 *   tooltip.
 *
 * The distinguishing rule is the border + navigability; a richer hovercard is a
 * composition concern (wrap in `Tooltip`).
 */
export function InlineRef({
  children,
  resolved = false,
  href,
  title,
  className,
  ...rest
}: InlineRefProps) {
  const base =
    'font-body underline-offset-2 border-b-[1.5px] cursor-help transition-colors duration-[120ms]'

  if (resolved && href) {
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
    <span title={title} className={cn(base, 'border-dashed border-ink/50 text-ink', className)}>
      {children}
    </span>
  )
}
