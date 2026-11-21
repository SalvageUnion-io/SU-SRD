/**
 * The Peek's place in the browser's HISTORY: a Peek a press opened holds one
 * entry, so Back closes it before it leaves the page, as it closes any sheet
 * on a phone. A Peek that hover or focus opened holds none: it closes when the
 * pointer or the focus leaves, and an entry per hover would wipe the reader's
 * Forward.
 *
 * - `opened()` pushes the entry (once per open Peek).
 * - Back pops it: the Peek closes and the page stays.
 * - `closed()` (a press outside, Escape) steps back over the entry, so it never
 *   outlives its Peek.
 * - A link followed while the Peek is open (Open page, the term's own second
 *   press) REPLACES the entry, so Back from that page lands on this one, once.
 *
 * For a page whose links are document loads (the Reference). The app's router
 * owns its history's state, so its host leaves this off.
 */

const MARK = 'suPeek'

type PeekHistoryWindow = Pick<Window, 'history' | 'location' | 'addEventListener'> &
  Pick<Window, 'removeEventListener'> & { document: Document }

function marked(state: unknown): boolean {
  return typeof state === 'object' && state !== null && MARK in state
}

export function installPeekHistory(win: PeekHistoryWindow, close: () => void) {
  let held = false
  // Our own step back over the entry is under way (`closed`).
  let leaving = false

  const push = () => {
    const state = win.history.state
    win.history.pushState({ ...(typeof state === 'object' ? state : {}), [MARK]: true }, '')
  }

  const onPopState = () => {
    if (leaving) {
      leaving = false
      // Another Peek opened before the step back landed: its entry goes in now.
      if (held) push()
      return
    }
    if (!held) return
    // Back took the entry: the Peek goes with it.
    held = false
    close()
  }

  // A page restored from the back/forward cache comes back as it was left,
  // Peek and all, on an entry that is no longer the Peek's.
  const onPageShow = (event: PageTransitionEvent) => {
    if (!event.persisted) return
    held = false
    close()
  }

  const onClick = (event: MouseEvent) => {
    if (!held || event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null
    if (!(link instanceof HTMLAnchorElement) || (link.target && link.target !== '_self')) return
    event.preventDefault()
    held = false
    win.location.replace(link.href)
  }

  win.addEventListener('popstate', onPopState)
  win.addEventListener('pageshow', onPageShow as EventListener)
  // Bubble phase, after the controller's capture: a press it held for the Peek
  // arrives prevented and is not a link followed.
  win.document.addEventListener('click', onClick)

  return {
    opened() {
      if (held) return
      held = true
      if (!leaving) push()
    },
    closed() {
      if (!held) return
      held = false
      if (leaving || !marked(win.history.state)) return
      leaving = true
      win.history.back()
    },
    uninstall() {
      win.removeEventListener('popstate', onPopState)
      win.removeEventListener('pageshow', onPageShow as EventListener)
      win.document.removeEventListener('click', onClick)
    },
  }
}
