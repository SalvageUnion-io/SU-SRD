/**
 * The table's notices' ties to the page (`TableNotices`): the hand overs this
 * browser dismissed, the strip's measured height and where the focus goes
 * after the turn or an answer.
 */

import { useCallback, useRef } from 'react'
import { NOTICES_RESIZED, YOUR_TURN_ID } from './tableNotices.model'

/** Where a dismissed hand over is remembered: it stays news for days, a tab does not. */
const ROLE_SEEN = 'su-role-notice-seen'

/** The hand overs this browser has dismissed, by event id. */
export function seenRoles(): string[] {
  try {
    const kept: unknown = JSON.parse(localStorage.getItem(ROLE_SEEN) ?? '[]')
    return Array.isArray(kept) ? kept.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function rememberRole(id: string): void {
  try {
    localStorage.setItem(ROLE_SEEN, JSON.stringify([...seenRoles(), id].slice(-20)))
  } catch {
    // Storage is off: the notice is dismissed for this tab alone.
  }
}

/**
 * The notices' height, published as `--su-table-notices-h` on the document:
 * under the Union bar a page's band starts behind the header's rail, so from
 * `lg` the notices take no room of their own and the band makes it for them
 * (`screens.css`), which keeps the rail on its band.
 */
export function useNoticesHeight() {
  const observer = useRef<ResizeObserver | null>(null)
  return useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect()
    observer.current = null
    const root = document.documentElement
    if (node === null || typeof ResizeObserver === 'undefined') {
      root.style.removeProperty('--su-table-notices-h')
      window.dispatchEvent(new Event(NOTICES_RESIZED))
      return
    }
    const publish = () => {
      root.style.setProperty('--su-table-notices-h', `${node.getBoundingClientRect().height}px`)
      // Play's frame sits under the notices and fills the window below them.
      window.dispatchEvent(new Event(NOTICES_RESIZED))
    }
    observer.current = new ResizeObserver(publish)
    observer.current.observe(node)
    publish()
  }, [])
}

/**
 * After End my turn, Accept or Decline (r5 A17): focus goes to the first
 * action's Use on a Play screen, else to the page's content, never the body.
 */
export function focusTheActions(): void {
  const uses = document.querySelectorAll<HTMLElement>('[data-action-key] button:not([disabled])')
  const use = [...uses].find((button) => button.closest('[hidden]') === null)
  ;(use ?? document.getElementById('main-content'))?.focus()
}

/** "Skip to your turn" (r5 A17): onto the turn's End my turn. */
export function focusYourTurn(): void {
  document.querySelector<HTMLElement>(`#${YOUR_TURN_ID} button:not([disabled])`)?.focus()
}
