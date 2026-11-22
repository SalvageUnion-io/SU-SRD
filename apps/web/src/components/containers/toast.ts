/**
 * The app's toast call: sonner's own, save that a toast with an action is held
 * to one rule (chrome K5; r5 C3). It stays `ACTION_TOAST_MS`, with a close of
 * its own, and at most `MOST_ACTION_TOASTS` stand at once: a newer one takes
 * the oldest down (Ctrl+Z and the Change Log still reach what its Undo did).
 * It holds while the pointer or the focus is on it (`SonnerToaster.tsx`).
 *
 * The app imports it from the barrel; the reference islands never do
 * (`toastRoll` loads sonner when a roll lands), so sonner stays out of the
 * chunk they share with the app.
 */
import type { ExternalToast } from 'sonner'
import { toast as sonner } from 'sonner'

/** How long a toast with an action stays. */
export const ACTION_TOAST_MS = 20_000

/** How many toasts with an action stand at once. */
export const MOST_ACTION_TOASTS = 3

let serial = 0

/** The options a toast is shown with: an action's are held to the rule. */
function held(options: ExternalToast | undefined): ExternalToast | undefined {
  if (!options?.action) return options
  serial += 1
  const id = options.id ?? `act:${serial}`
  // Sonner keeps them oldest first; one shown again under its id keeps its place.
  const others = sonner
    .getToasts()
    .filter((each) => 'action' in each && each.action && each.id !== id)
  for (const old of others.slice(0, Math.max(0, others.length - (MOST_ACTION_TOASTS - 1))))
    sonner.dismiss(old.id)
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
