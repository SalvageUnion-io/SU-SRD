/**
 * Where the document's toasts stand: the foot of the screen, unless a screen
 * holds them at the top.
 *
 * A phone's Play screen does (r2 C4): its controls are at thumb height, an
 * action's button and a roll's outcome just above the tab row, which is where
 * a toast at the foot lands. Held, the toasts stand under the Play bar and
 * the pinned strip (`PlayFrame` says where, r3 H2), never over what is being
 * pressed.
 *
 * A Play screen holds them its own way (r6 A3): one at a time, a newer one
 * replacing the older, at the bottom left from `lg`, clear of the Propose dock
 * and Mediate's right column, and above the tab row on a phone
 * (`holdPlayToasts`).
 *
 * Counted, so two screens that hold (a route changing) never fight; no React
 * here but the hooks.
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

let plays = 0

function changePlay(by: number): void {
  plays += by
  for (const listener of listeners) listener()
}

/** Hold the toasts as Play does (one at a time, bottom left) while the caller is on screen. */
export function holdPlayToasts(): () => void {
  changePlay(1)
  let held = true
  return () => {
    if (!held) return
    held = false
    changePlay(-1)
  }
}

const onTop = () => holds > 0
const inPlay = () => plays > 0
const atFoot = () => false

/** Whether a screen holds the toasts at the top. */
export function useToastsOnTop(): boolean {
  return useSyncExternalStore(subscribe, onTop, atFoot)
}

/** Whether a Play screen holds the toasts: one at a time, bottom left (r6 A3). */
export function usePlayToasts(): boolean {
  return useSyncExternalStore(subscribe, inPlay, atFoot)
}
