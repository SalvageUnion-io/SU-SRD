import type { AnchorHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { FOCUS_RING } from './interaction'

type InlineRefProps = {
  children: ReactNode
  /**
   * Destination for a resolved, navigable reference. Present → a real `<a>`
   * (rust border, keyboard-reachable); absent → an inert prose mark (ink
   * dashed border) that only summons a tooltip.
   */
  href?: string
  /**
   * An opener for a reference with no route but a view to open (The app's Page,
   * entity display language E4): a `<button>` worn as the same rust link. An
   * `href` wins.
   */
  onOpen?: () => void
  /** Native tooltip text (the glance). */
  title?: string
  className?: string
} & Omit<HTMLAttributes<HTMLElement>, 'title' | 'className' | 'children' | 'onClick'> &
  /** A link's own attributes (an external link opening in a new tab). */
  Pick<AnchorHTMLAttributes<HTMLAnchorElement>, 'target' | 'rel' | 'download'>

/**
 * InlineRef — an in-prose entity reference or link (ruleset §"Inline reference /
 * link"). Every prose link in either app is one: with `Button`, this is the
 * only thing allowed to paint rust (ruleset §3.1, `tokens/rust-allowlist`).
 *
 * A word inside body text that reads its state from what it can do:
 * - **Navigable** (`href` set) — a rust border-bottom; navigates via a real
 *   `<a href>`, so it is keyboard-reachable (the one rust element allowed in
 *   read-only prose, ruleset §3.1).
 * - **Opens** (`onOpen` set) — the same rust word as a `<button>`, for a view
 *   with no route (The app's Page).
 * - **Inert** (neither) — an ink **dashed** border-bottom with `cursor-help`;
 *   it only summons the Peek.
 *
 * The distinguishing rule is the border + navigability; the Peek is a
 * composition concern (`Mention`). The word keeps its prose's own type and
 * colour, so a reference reads on any ground — paper prose, an ink roll band,
 * a tone header (`.su-inline-ref` in `styles/partials/inline-ref.css`). Extra attributes (a Peek
 * trigger's `data-peek`) reach the element in every state.
 */
export function InlineRef({ children, href, onOpen, title, className, ...rest }: InlineRefProps) {
  if (href) {
    return (
      <a
        href={href}
        title={title}
        className={cn('su-inline-ref su-inline-ref--link', FOCUS_RING, className)}
        {...rest}
      >
        {children}
      </a>
    )
  }

  // The anchor's attributes that a span or a button also takes: the data and
  // aria attributes and the handlers the host passes.
  const { target: _target, rel: _rel, download: _download, ...shared } = rest

  if (onOpen) {
    return (
      <button
        type="button"
        title={title}
        className={cn(
          'su-inline-ref su-inline-ref--link su-inline-ref--button',
          FOCUS_RING,
          className
        )}
        {...shared}
        onClick={(event) => {
          // A reference inside a clickable card opens ITS entity, not the card's.
          event.stopPropagation()
          onOpen()
        }}
      >
        {children}
      </button>
    )
  }

  return (
    <span title={title} className={cn('su-inline-ref su-inline-ref--inert', className)} {...shared}>
      {children}
    </span>
  )
}
