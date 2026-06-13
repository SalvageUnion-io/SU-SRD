/**
 * useDialogA11y — lightweight focus-trap + Escape-to-close hook for
 * custom role=dialog modals.
 *
 * On mount:
 *  - Saves the previously-focused element so it can be restored on close.
 *  - Moves focus to the first focusable element inside the dialog container.
 *
 * While open:
 *  - Traps Tab / Shift+Tab within the dialog.
 *  - Calls `onClose` on Escape keydown.
 *
 * On unmount:
 *  - Restores focus to the element that was focused before the dialog opened.
 *
 * Usage:
 *   const dialogRef = useRef<HTMLDivElement>(null)
 *   useDialogA11y({ ref: dialogRef, onClose })
 *   // then: <div ref={dialogRef} role="dialog" ...>
 */

import { useEffect } from 'react'
import type { RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

type UseDialogA11yOptions = {
  /** Ref pointing at the dialog panel element (not the backdrop). */
  ref: RefObject<HTMLElement | null>
  /** Called when the user presses Escape. */
  onClose: () => void
}

export function useDialogA11y({ ref, onClose }: UseDialogA11yOptions): void {
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null

    // Move focus to the first focusable element inside the dialog.
    const el = ref.current
    if (el) {
      const focusable = el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      const first = focusable[0]
      if (first) {
        first.focus()
      } else {
        // If no focusable children exist, focus the container itself.
        el.setAttribute('tabindex', '-1')
        el.focus()
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key === 'Tab') {
        const container = ref.current
        if (!container) return

        const focusable = Array.from(
          container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((node) => !node.hasAttribute('disabled'))

        if (focusable.length === 0) {
          e.preventDefault()
          return
        }

        const first = focusable[0]!
        const last = focusable[focusable.length - 1]!

        if (e.shiftKey) {
          // Shift+Tab: if focus is on the first element, wrap to last.
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          // Tab: if focus is on the last element, wrap to first.
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // Restore focus to the element that was active before the dialog opened.
      previouslyFocused?.focus()
    }
    // We only want this to run once on mount (dialog open).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
