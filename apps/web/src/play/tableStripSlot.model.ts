/**
 * Where a Play screen keeps the table's strip (r6 A1): the frame's slot under
 * its bar (`PlayFrame`), which the root's `TableNotices` draws into, and what
 * the screen itself has to say there (`setScreenNotices`: the Heat Check due,
 * r6 A6), solo too. No React here but the hooks, so the root's notices carry
 * nothing of Play's.
 */

import { useSyncExternalStore } from 'react'
import type { Notice } from './TableNoticeStack'

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

/** What the open Play screen puts on the strip, by who says it: the Heat Check, the trial's line. */
const bySource = new Map<string, readonly Notice[]>()
let screenNotices: readonly Notice[] = []

/** `source`'s notices on the strip; empty takes them down. */
export function setScreenNotices(source: string, next: readonly Notice[]): void {
  const sig = (list: readonly Notice[]) => list.map((n) => n.sig).join('\n')
  if (sig(next) === sig(bySource.get(source) ?? [])) return
  if (next.length === 0) bySource.delete(source)
  else bySource.set(source, next)
  screenNotices = [...bySource.values()].flat()
  for (const listener of listeners) listener()
}

const currentNotices = () => screenNotices
const EMPTY: readonly Notice[] = []
const noNotices = () => EMPTY

/** The open Play screen's own notices for the strip. */
export function useScreenNotices(): readonly Notice[] {
  return useSyncExternalStore(subscribe, currentNotices, noNotices)
}
