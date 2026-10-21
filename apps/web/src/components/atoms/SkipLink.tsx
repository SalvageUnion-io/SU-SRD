import { cn } from '../../lib/cn'
import { capsLabel } from './capsLabel'

/** Off screen until focused, then pinned to the top corner (`foundation.css`). */
const SKIP_LINK = cn('su-skip-link', capsLabel())

/**
 * The skip link (WCAG 2.4.1): the first focusable thing on every page, the
 * reference layout's and the app shell's alike, so a keyboard reader passes
 * the bar and its navs in one key. It targets the page's `#main-content`,
 * which must be focusable (`tabIndex={-1}`) for focus, not just the scroll,
 * to move there.
 */
export function SkipLink() {
  return (
    <a href="#main-content" className={SKIP_LINK}>
      Skip to content
    </a>
  )
}
