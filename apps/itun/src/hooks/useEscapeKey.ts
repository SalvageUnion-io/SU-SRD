import { useEffect } from 'react'

/**
 * Call `onEscape` while `active`, when Escape is pressed.
 *
 * The dashboard's overlays — the dial config panel, the band's resolve/damage/
 * storage prompts, the table picker — each open over a region rather than in a
 * `<dialog>`, so none of them inherited the platform's dismiss behaviour, and
 * the cockpit directory had no keydown handling at all. Escape did nothing
 * anywhere, which is how two overlays could end up open at once.
 *
 * Listens on the document during the CAPTURE phase so it still fires when focus
 * is inside an input or a button in the overlay, and only binds while `active`
 * so a closed overlay costs nothing and cannot steal the key from whatever is
 * still open above it.
 */
export function useEscapeKey(active: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!active) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      onEscape()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [active, onEscape])
}
