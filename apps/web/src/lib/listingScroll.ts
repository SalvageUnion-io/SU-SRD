/**
 * A listing's scroll position, kept with its history entry, so Back lands on
 * the row the reader left (r3 C1).
 *
 * The browser restores the scroll over the SERVED rows, the whole list in its
 * default view, before the listing has drawn what this visit shows. Where
 * that list is shorter than the one the reader left (a Catalog over a served
 * table), the browser stops short. So the listing writes its position into
 * the entry's state as the page is left, and puts it back once its own rows
 * are in place, on a Back or Forward visit only.
 */

const MARK = 'suListingY'

type ScrollWindow = Pick<Window, 'history' | 'scrollY' | 'scrollTo' | 'addEventListener'> &
  Pick<Window, 'removeEventListener' | 'performance'>

function remembered(state: unknown): number | undefined {
  if (typeof state !== 'object' || state === null) return undefined
  const y = (state as Record<string, unknown>)[MARK]
  return typeof y === 'number' ? y : undefined
}

/** Whether this visit came by Back or Forward. */
function restored(win: ScrollWindow): boolean {
  const [entry] = win.performance.getEntriesByType('navigation')
  return (entry as PerformanceNavigationTiming | undefined)?.type === 'back_forward'
}

/**
 * Call once the listing's own rows are in place. Restores the position a Back
 * or Forward visit left, and keeps this entry's position as the page is left.
 * Returns its teardown.
 */
export function keepListingScroll(win: ScrollWindow = window): () => void {
  const y = remembered(win.history.state)
  if (y !== undefined && restored(win) && Math.abs(win.scrollY - y) > 1) win.scrollTo(0, y)

  const remember = () => {
    const state = win.history.state
    win.history.replaceState(
      { ...(typeof state === 'object' && state !== null ? state : {}), [MARK]: win.scrollY },
      ''
    )
  }
  win.addEventListener('pagehide', remember)
  return () => win.removeEventListener('pagehide', remember)
}
