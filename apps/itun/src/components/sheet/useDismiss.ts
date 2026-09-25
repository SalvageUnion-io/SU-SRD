import type { RefObject } from 'react'
import { useEffect } from 'react'

/**
 * Light-dismiss for non-modal popovers (overflow menus, the quick-roll
 * panel): while `open`, Escape or a pointerdown outside `ref` calls
 * `onDismiss`. Modal flows should keep using ModalShell (base-ui Dialog);
 * this hook is for small anchored panels that must not trap focus.
 */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onDismiss: () => void
): void {
  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismiss()
    }

    function handlePointerDown(event: PointerEvent) {
      const el = ref.current
      if (el && event.target instanceof Node && !el.contains(event.target)) onDismiss()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [ref, open, onDismiss])
}
