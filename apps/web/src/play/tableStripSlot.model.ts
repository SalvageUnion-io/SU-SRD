/**
 * Where a Play screen keeps the table's strip (r6 A1): the frame's slot under
 * its bar (`PlayFrame`), which the root's `TableNotices` draws into. No React
 * here but the one hook, so the root's notices carry nothing of Play's.
 */

import { useSyncExternalStore } from 'react'

let slot: HTMLElement | null = null
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The frame's ref: the slot as it mounts, null as it goes. */
export function setTableStripSlot(node: HTMLElement | null): void {
  if (node === slot) return
  slot = node
  for (const listener of listeners) listener()
}

const current = () => slot
const none = () => null

/** The Play screen's strip slot, or null off Play. */
export function useTableStripSlot(): HTMLElement | null {
  return useSyncExternalStore(subscribe, current, none)
}
