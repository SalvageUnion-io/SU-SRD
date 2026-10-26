/**
 * Which units anyone with the link may read (ADR-032), as the rooms serve
 * them: `publicRead` is a column beside a unit's body, never in it, so the
 * replica's rows cannot answer it. Each room's snapshot replaces its scope's,
 * and each applied unit or departure updates one. Framework-free; fed by
 * `roomSocket.ts`.
 */

import { useSyncExternalStore } from 'react'
import type { Scope } from './replica'

type Held = { appId: string; publicRead: boolean }

const held = new Map<Scope, Map<string, boolean>>()
const listeners = new Set<() => void>()
let shared: readonly string[] = []

function changed(): void {
  shared = [
    ...new Set(
      [...held.values()].flatMap((units) => [...units].flatMap(([id, on]) => (on ? [id] : [])))
    ),
  ]
  for (const listener of listeners) listener()
}

/** A room's snapshot: its scope's units, whole. */
export function holdSharedByLink(scope: Scope, units: readonly Held[]): void {
  held.set(scope, new Map(units.map((u) => [u.appId, u.publicRead])))
  changed()
}

/** One unit, applied or arrived in `scope`. */
export function putSharedByLink(scope: Scope, unit: Held): void {
  const units = held.get(scope)
  if (units === undefined || units.get(unit.appId) === unit.publicRead) return
  units.set(unit.appId, unit.publicRead)
  changed()
}

/** A unit that left `scope`. */
export function dropSharedByLink(scope: Scope, appId: string): void {
  if (held.get(scope)?.delete(appId) === true) changed()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Every unit shared by link in any open room: Convex's `shelf.sharedByLink`. */
export function useSharedByLinkRooms(): readonly string[] {
  return useSyncExternalStore(subscribe, () => shared)
}

/** Whether one unit in `scope` is shared by link; undefined before that room's snapshot. */
export function useUnitSharedByLink(scope: Scope, appId: string): boolean | undefined {
  return useSyncExternalStore(subscribe, () => {
    const units = held.get(scope)
    return units === undefined ? undefined : units.get(appId) === true
  })
}
