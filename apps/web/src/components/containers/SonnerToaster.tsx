import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { Toaster as SonnerToaster } from 'sonner'
import { widthAtLeast } from '../../design/breakpoint'
import { borderWidth, color, font, fontSize, radius, shadow } from '../../design/tokens'
import { holdToastsOnFocus } from './toastFocusHold'
import { usePlayToasts, useToastsOnTop } from './toastPlacement'

/** Sonner's own radius variable, set to the popup radius (ruleset §4.4). */
const TOASTER = { '--border-radius': radius.card } as CSSProperties

/** A toast: ink, paper text, the popup radius and the one lift (chrome K4). */
const TOAST = {
  background: color.ink,
  border: `${borderWidth.hairline} solid ${color.ink2}`,
  borderRadius: radius.card,
  boxShadow: shadow.lift,
  color: color.paper,
  fontFamily: font.body,
  fontSize: fontSize.caption,
} satisfies CSSProperties

/**
 * A phone's toast stands clear of a tab row at the screen's foot and of the
 * home indicator: `--su-toast-bottom` (`styles/partials/atoms-leaves.css`).
 * Held at the top (`toastPlacement.ts`), it stands under the status bar and
 * Play's bar: `--su-toast-top`.
 */
const MOBILE_OFFSET = {
  bottom: 'var(--su-toast-bottom)',
  top: 'var(--su-toast-top)',
} as const

/** A dialog that is open: its head (title, close) stands at the top. */
const DIALOG = '[role="dialog"], [role="alertdialog"]'

/** A phone, below the ladder's first rung (chrome K2). */
const PHONE = `not ${widthAtLeast('sm')}`

/**
 * Whether a dialog is open on a phone (r7 A4): its toasts then stand at the
 * foot, clear of its title and close. Read off the document, as every dialog
 * portals into it, so no dialog has to tell the toaster.
 */
function useDialogOnPhone(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (typeof MutationObserver === 'undefined' || typeof window.matchMedia !== 'function') return
    const phone = window.matchMedia(PHONE)
    // A mutation record batch arrives once per task: one look a batch.
    const read = () => setOpen(phone.matches && document.querySelector(DIALOG) !== null)
    const watch = new MutationObserver(read)
    watch.observe(document.body, { childList: true, subtree: true })
    phone.addEventListener('change', read)
    read()
    return () => {
      watch.disconnect()
      phone.removeEventListener('change', read)
    }
  }, [])
  return open
}

/**
 * The toast region, as configured. Render it only through `ToasterMount`,
 * which keeps it to one per document (chrome K5). Its own module, loaded when
 * a toaster first mounts, so a reference page's islands never ship sonner
 * until one draws.
 */
export function Toaster() {
  // A phone's Play screen holds its toasts at the top, under its bar, off its controls (r2 C4, r3 H2).
  // A dialog's head is never under a toast (r7 A4): over one, a phone's toasts stand at the foot.
  const overDialog = useDialogOnPhone()
  const onTop = useToastsOnTop() && !overDialog
  // Play's: bottom left (r6 A3).
  const play = usePlayToasts()
  // A toast holds under the focus as under the pointer (chrome K5).
  useEffect(() => holdToastsOnFocus(), [])
  return (
    <SonnerToaster
      position={onTop ? 'top-center' : play ? 'bottom-left' : 'bottom-right'}
      // One at a time everywhere (r7 A4): a newer replaces the older (`toast.ts`).
      visibleToasts={1}
      mobileOffset={MOBILE_OFFSET}
      style={TOASTER}
      toastOptions={{
        style: TOAST,
        // The status icon's colour: `.su-toast--ok` / `--bad`; the
        // description's paper: `.su-toast__description` (atoms-leaves.css).
        classNames: {
          success: 'su-toast--ok',
          error: 'su-toast--bad',
          description: 'su-toast__description',
        },
      }}
    />
  )
}
