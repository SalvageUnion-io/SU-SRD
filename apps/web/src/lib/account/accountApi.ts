/**
 * The account's reads and writes, on the Worker's routes (`ACCOUNT_PATHS`,
 * `worker/accountRoutes.ts`): who is signed in, their profile and export,
 * their feedback, an admin's metrics, and the build floor.
 *
 * A read is fetched once per signed-in player and shared by every component
 * that asks; a write fetches again what it changed.
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { RoomDeclined } from '../../replica/roomSocket'
import { ACCOUNT_PATHS } from '../../rooms/routes'
import type { AccountExport, Me } from '../../worker/accountRoutes'
import type { MetricsRead } from '../../worker/shared/signals'
import { useMyPerson } from '../auth/session'

/** Who is signed in, or null for nobody. */
export type MeAnswer = Me | null
/** The name and avatar overrides; a blank one clears it, one left out is kept. */
type ProfilePatch = { displayName?: string | null; avatarUrl?: string | null }
/** One "Suggest or report" note; `page` is the app path it was sent from. */
type FeedbackNote = { kind: 'suggestion' | 'report'; text: string; page?: string }
/** The admin metrics, or null for anyone else. */
export type AdminMetrics = MetricsRead | null

/** One Worker route's answer as JSON; a refusal throws a `RoomDeclined` with its words. */
async function ask<T>(path: string, init?: { body: unknown }): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...(init === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(init.body),
        }),
  })
  const answer = (await res.json().catch(() => null)) as { refusal?: string } | null
  if (res.status === 400 && typeof answer?.refusal === 'string') {
    throw new RoomDeclined(answer.refusal)
  }
  if (!res.ok) throw new Error(`${path} answered ${res.status}`)
  return answer as T
}

// ── Worker reads, shared by key ───────────────────────────────────────────

type Entry = { value: unknown; loaded: boolean; asking: boolean; listeners: Set<() => void> }
const entries = new Map<string, Entry>()

function entryOf(key: string): Entry {
  let entry = entries.get(key)
  if (entry === undefined) {
    entry = { value: undefined, loaded: false, asking: false, listeners: new Set() }
    entries.set(key, entry)
  }
  return entry
}

function load(key: string, path: string): void {
  const entry = entryOf(key)
  if (entry.asking) return
  entry.asking = true
  void ask(path)
    .then(
      (value) => {
        entry.value = value
        entry.loaded = true
      },
      // Unreachable: the read stays loading until it is asked again.
      () => undefined
    )
    .finally(() => {
      entry.asking = false
      for (const listener of entry.listeners) listener()
    })
}

/** Ask again for every held read of `path`; the components showing it follow. */
function reload(path: string): void {
  for (const key of entries.keys()) if (key.startsWith(`${path}|`)) load(key, path)
}

/** `path`'s answer for the signed-in player, `undefined` while loading or skipped. */
function useWorkerRead<T>(path: string, enabled: boolean): T | undefined {
  const person = useMyPerson()
  const key = enabled && person !== null ? `${path}|${person}` : null
  const subscribe = useCallback(
    (listener: () => void) => {
      if (key === null) return () => undefined
      const entry = entryOf(key)
      entry.listeners.add(listener)
      return () => entry.listeners.delete(listener)
    },
    [key]
  )
  const value = useSyncExternalStore(
    subscribe,
    () => (key === null ? undefined : entries.get(key)?.value),
    () => undefined
  )
  useEffect(() => {
    if (key !== null && !entryOf(key).loaded) load(key, path)
  }, [key, path])
  return value as T | undefined
}

// ── The hooks ─────────────────────────────────────────────────────────────

/** Who is signed in; skipped while `enabled` is false. */
export function useMe(enabled = true): MeAnswer | undefined {
  return useWorkerRead<MeAnswer>(ACCOUNT_PATHS.me, enabled)
}

/** Set the display name or avatar override. */
export function useUpdateProfile(): (patch: ProfilePatch) => Promise<void> {
  return useCallback(async (patch: ProfilePatch) => {
    await ask(ACCOUNT_PATHS.profile, { body: patch })
    reload(ACCOUNT_PATHS.me)
  }, [])
}

/** Everything the player owns, for download. */
export function useAccountExport(): AccountExport | undefined {
  return useWorkerRead<AccountExport>(ACCOUNT_PATHS.export, true)
}

/** "Suggest or report". */
export function useSubmitFeedback(): (note: FeedbackNote) => Promise<null> {
  return useCallback((note: FeedbackNote) => ask<null>(ACCOUNT_PATHS.feedback, { body: note }), [])
}

/** The usage metrics for an admin, null for anyone else. */
export function useAdminMetrics(): AdminMetrics | undefined {
  return useWorkerRead<AdminMetrics>(ACCOUNT_PATHS.metrics, true)
}

/** Take a fresh metrics snapshot now. Admins only. */
export function useRefreshMetrics(): () => Promise<null> {
  return useCallback(async () => {
    await ask(ACCOUNT_PATHS.refreshMetrics, { body: {} })
    reload(ACCOUNT_PATHS.metrics)
    return null
  }, [])
}

/** The backend's build floor, from the Worker; `undefined` when it could not be asked. */
export function askFloor(): Promise<number | undefined> {
  return ask<number>(ACCOUNT_PATHS.floor).then(
    (floor) => (typeof floor === 'number' ? floor : undefined),
    () => undefined
  )
}
