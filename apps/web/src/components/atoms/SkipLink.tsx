import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { atomsCopy } from '../../messages/components-atoms'
import { capsLabel } from './capsLabel'

/** Off screen until focused, then pinned to the top corner (`foundation.css`). */
const SKIP_LINK = cn('su-skip-link', capsLabel())

/**
 * The skip link (WCAG 2.4.1): the first focusable thing on every page, the
 * reference layout's and the app shell's alike, so a keyboard reader passes
 * the bar and its navs in one key. It targets the page's `#main-content`,
 * which must be focusable (`tabIndex={-1}`) for focus, not just the scroll,
 * to move there.
 *
 * A screen with a long way to its parts adds its own after it (Mediate's
 * jumps, `PlayFrame`): `to` is the part's id, `children` its words, and
 * `onFollow` takes the press where the part must be shown first (a tab).
 */
export function SkipLink({
  to = 'main-content',
  children = atomsCopy('skipToContent'),
  onFollow,
}: {
  /** The id of what it skips to. */
  to?: string
  children?: ReactNode
  /** Takes the press in the link's place: show the part, then move focus there. */
  onFollow?: () => void
}) {
  return (
    <a
      href={`#${to}`}
      className={SKIP_LINK}
      onClick={
        onFollow
          ? (event) => {
              event.preventDefault()
              onFollow()
            }
          : undefined
      }
    >
      {children}
    </a>
  )
}
