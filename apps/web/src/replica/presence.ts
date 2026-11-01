/**
 * Who is at each Game's table, as its room last said (`presence` frames on
 * the Game's socket, `roomSocket.ts`): the member ids sitting there, or null
 * while the socket is closed. Held in memory per Game scope, never stored.
 * Framework-free.
 */

import type { Scope } from './replica'

const held = new Map<Scope, ReadonlySet<string>>()
const listeners = new Set<() => void>()

/** Hold who the room says is here, or forget it (null) when its socket closes. */
export function holdPresence(scope: Scope, here: readonly string[] | null): void {
  if (here === null) held.delete(scope)
  else held.set(scope, new Set(here))
  for (const listener of listeners) listener()
}

/** Who is here at the scope's table; null until its room says. */
export function readPresence(scope: Scope): ReadonlySet<string> | null {
  return held.get(scope) ?? null
}

export function subscribePresence(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
