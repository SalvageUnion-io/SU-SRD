/**
 * Focus stays with the reader when a press disables its own button (r8 F4,
 * SB8-20): the second of two equipment picks, Roll the rest. A disabled
 * button drops the focus to the page, so the next Tab starts again from the
 * top; this hands it to the next control a keyboard can still reach.
 */

import { useEffect } from 'react'

/** What a keyboard can reach: a link, an enabled field or button, a tab stop. */
const LIVE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/** The first live control after `from` in the document's order; null when none follows. */
export function nextLiveControl(from: Element, scope: ParentNode = document): HTMLElement | null {
  for (const el of scope.querySelectorAll<HTMLElement>(LIVE)) {
    if (el === from || el.closest('[hidden],[inert],[aria-hidden="true"]')) continue
    if (from.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) return el
  }
  return null
}

/** While mounted: the button that had the focus, once disabled, passes it on. */
export function useFocusKeptOnDisable(): void {
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return
    let last: Element | null = null
    const remember = (event: FocusEvent) => {
      last = event.target instanceof Element ? event.target : null
    }
    const observer = new MutationObserver((records) => {
      for (const { target } of records) {
        if (!(target instanceof HTMLButtonElement) || !target.disabled) continue
        const active = document.activeElement
        // It had the focus: it still holds it, or the page took it from it.
        const held =
          active === target || (target === last && (active === null || active === document.body))
        if (!held) continue
        nextLiveControl(target)?.focus()
      }
    })
    document.addEventListener('focusin', remember)
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['disabled'],
      subtree: true,
    })
    return () => {
      document.removeEventListener('focusin', remember)
      observer.disconnect()
    }
  }, [])
}
