/**
 * The app's toast call: sonner's own, held to one rule (chrome K5; r5 C3, r7
 * A4). One toast stands at a time: a newer one replaces the older instead of
 * stacking behind it (Ctrl+Z and the Change Log still reach what an older
 * Undo did). One with an action stays `ACTION_TOAST_MS`, with a close of its
 * own, and holds while the pointer or the focus is on it
 * (`SonnerToaster.tsx`).
 *
 * The app imports it from the barrel; the reference islands never do
 * (`toastRoll` loads sonner when a roll lands), so sonner stays out of the
 * chunk they share with the app.
 */
import type { ExternalToast } from 'sonner'
import { toast as sonner } from 'sonner'

/** How long a toast with an action stays. */
export const ACTION_TOAST_MS = 20_000

/** How many toasts stand at once (r7 A4): the newest. */
export const MOST_ACTION_TOASTS = 1

let serial = 0

/** The options a toast is shown with; every older toast leaves for it. */
function held(options: ExternalToast | undefined): ExternalToast {
  serial += 1
  const id = options?.id ?? `toast:${serial}`
  // One shown again under its id keeps its place, and is replaced in place.
  for (const old of sonner.getToasts()) if (old.id !== id) sonner.dismiss(old.id)
  if (!options?.action) return { ...options, id }
  return { ...options, id, duration: ACTION_TOAST_MS, closeButton: true }
}

type Say = typeof sonner.success

const saying =
  (say: Say): Say =>
  (message, options) =>
    say(message, held(options))

export const toast: typeof sonner = Object.assign(saying(sonner) as typeof sonner, sonner, {
  success: saying(sonner.success),
  info: saying(sonner.info),
  warning: saying(sonner.warning),
  error: saying(sonner.error),
  message: saying(sonner.message),
})
