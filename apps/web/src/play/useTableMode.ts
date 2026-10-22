/**
 * useTableMode — whether a phone's Play shows table mode (play.md §11): one
 * focused screen in place of the tabs. This device's choice, remembered
 * across visits; the bar's TABLE toggle sets it, `PlayCockpitPhone` reads it.
 *
 * One value shared by both, so module state behind `useSyncExternalStore`;
 * storage is a convenience (`safeLocalStorage`), and without it the toggle
 * still works for the visit.
 */

import { useSyncExternalStore } from 'react'
import { localStore } from '../lib/safeLocalStorage'

const KEY = 'su:play-table-mode'

function readStored(): boolean {
  try {
    return localStore()?.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

let on: boolean | null = null
const listeners = new Set<() => void>()

function snapshot(): boolean {
  on ??= readStored()
  return on
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function setTableMode(next: boolean): void {
  on = next
  try {
    localStore()?.setItem(KEY, next ? 'on' : 'off')
  } catch {
    // Not remembered past this visit; the toggle still works.
  }
  for (const listener of [...listeners]) listener()
}

/** Table mode, and its setter. */
export function useTableMode(): [boolean, (on: boolean) => void] {
  return [useSyncExternalStore(subscribe, snapshot, () => false), setTableMode]
}

/** A unit test's reset: forget the module's value so storage is read again. */
export function resetTableMode(): void {
  on = null
}
