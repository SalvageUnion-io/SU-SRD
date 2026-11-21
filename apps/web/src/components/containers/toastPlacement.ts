/**
 * Where the document's toasts stand: the foot of the screen, unless a screen
 * holds them at the top.
 *
 * A phone's Play screen does (r2 C4): its controls are at thumb height, an
 * action's button and a roll's outcome just above the tab row, which is where
 * a toast at the foot lands. Held, the toasts stand over the Play bar, above
 * the pinned strip, and never over what is being pressed.
 *
 * Counted, so two screens that hold (a route changing) never fight; no React
 * here but the one hook.
 */

import { useSyncExternalStore } from 'react'

let holds = 0
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function change(by: number): void {
  holds += by
  for (const listener of listeners) listener()
}

/** Hold the toasts at the top while the caller is on screen; call the answer to let go. */
export function holdToastsOnTop(): () => void {
  change(1)
  let held = true
  return () => {
    if (!held) return
    held = false
    change(-1)
  }
}

const onTop = () => holds > 0
const atFoot = () => false

/** Whether a screen holds the toasts at the top. */
export function useToastsOnTop(): boolean {
  return useSyncExternalStore(subscribe, onTop, atFoot)
}
