/**
 * The Mediator's last change to an Opposition vital (r8 B4), per Game: what
 * the Undo toast undoes, kept so the Mediate ⋯ can offer "Undo last change"
 * after the toast has gone. One change deep, the device's own; an undo spends it.
 */

import { useSyncExternalStore } from 'react'

export type OppositionChange = { label: string; undo: () => void }

const last = new Map<string, OppositionChange>()
const listeners = new Set<() => void>()
const tell = () => {
  for (const listener of listeners) listener()
}

/** Keep `change` as the Game's last one, replacing any before it. */
export function keepChange(gameId: string, change: OppositionChange): void {
  last.set(gameId, change)
  tell()
}

/** Undo the Game's last change, once; false when there is none. */
export function undoLastChange(gameId: string): boolean {
  const change = last.get(gameId)
  if (change === undefined) return false
  last.delete(gameId)
  tell()
  change.undo()
  return true
}

/** Forget a change that was undone another way (its toast's Undo). */
export function dropChange(gameId: string, change: OppositionChange): void {
  if (last.get(gameId) !== change) return
  last.delete(gameId)
  tell()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The Game's last change, or undefined; redraws as it changes. */
export function useLastChange(gameId: string): OppositionChange | undefined {
  return useSyncExternalStore(
    subscribe,
    () => last.get(gameId),
    () => undefined
  )
}
