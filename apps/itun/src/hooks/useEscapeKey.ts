import { useEffect } from 'react'

/**
 * Call `onEscape` while `active`, when Escape is pressed.
 *
 * For the Major's band overlays (`MajorFrame`: the resolve, damage and storage
 * prompts), which replace the band they open over rather than open as a
 * dialog, so they have no dismiss behaviour of their own.
 *
 * Listens on the document during the CAPTURE phase so it still fires when focus
 * is inside an input or a button in the overlay, and only binds while `active`
 * so a closed overlay costs nothing. It marks the Escape handled
 * (`preventDefault`), so a `ModalShell` around the Major — the ⤢ overlay — does
 * not close on the same key.
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
