/**
 * The account's reads and writes, wherever this build keeps them: Convex's
 * `account.*`, `feedback.submit` and `metrics.*`, or, where the build turns
 * the rooms on (`VITE_ROOM_FEED`), the Worker's routes (`ACCOUNT_PATHS`,
 * `worker/accountRoutes.ts`). Each hook is picked once, when the module
 * loads, so a component calls the same hooks on every render.
 *
 * A Worker read is fetched once per signed-in player and shared by every
 * component that asks; a write fetches again what it changed.
 */

import { useMutation, useQuery } from 'convex/react'
import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { api } from '../../../convex/_generated/api'
import { ROOM_FEED, RoomDeclined } from '../../replica/roomSocket'
import { ACCOUNT_PATHS } from '../../rooms/routes'
import type { AccountExport, Me } from '../../worker/accountRoutes'
import { useMyPerson } from '../auth/session'

type ConvexMe = FunctionReturnType<typeof api.account.me>
type ConvexExport = FunctionReturnType<typeof api.account.exportMine>
type ProfilePatch = FunctionArgs<typeof api.account.updateProfile>
type FeedbackNote = FunctionArgs<typeof api.feedback.submit>
/** The admin metrics, or null for anyone else. */
export type AdminMetrics = FunctionReturnType<typeof api.metrics.forAdmin>

/** Who is signed in: `_id` is the Convex users id either way. */
export type MeAnswer = (NonNullable<ConvexMe> & Partial<Pick<Me, 'discordId'>>) | null

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
      // Unreachable: the read stays loading, as a Convex query does offline.
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

/** Who is signed in (`account.me`); skipped while `enabled` is false. */
export const useMe: (enabled?: boolean) => MeAnswer | undefined = ROOM_FEED
  ? (enabled = true) => useWorkerRead<Me | null>(ACCOUNT_PATHS.me, enabled) as MeAnswer | undefined
  : (enabled = true) => useQuery(api.account.me, enabled ? {} : 'skip')

/** Set the display name or avatar override (`account.updateProfile`). */
export const useUpdateProfile: () => (patch: ProfilePatch) => Promise<unknown> = ROOM_FEED
  ? () =>
      useCallback(async (patch: ProfilePatch) => {
        await ask(ACCOUNT_PATHS.profile, { body: patch })
        reload(ACCOUNT_PATHS.me)
      }, [])
  : () => useMutation(api.account.updateProfile)

/** Everything the player owns, for download (`account.exportMine`). */
export const useAccountExport: () => ConvexExport | AccountExport | undefined = ROOM_FEED
  ? () => useWorkerRead<AccountExport>(ACCOUNT_PATHS.export, true)
  : () => useQuery(api.account.exportMine, {})

/** "Suggest or report" (`feedback.submit`). */
export const useSubmitFeedback: () => (note: FeedbackNote) => Promise<null> = ROOM_FEED
  ? () => useCallback((note: FeedbackNote) => ask<null>(ACCOUNT_PATHS.feedback, { body: note }), [])
  : () => useMutation(api.feedback.submit)

/** The usage metrics for an admin, null for anyone else (`metrics.forAdmin`). */
export const useAdminMetrics: () => AdminMetrics | undefined = ROOM_FEED
  ? () => useWorkerRead<AdminMetrics>(ACCOUNT_PATHS.metrics, true)
  : () => useQuery(api.metrics.forAdmin, {})

/** Take a fresh metrics snapshot now (`metrics.refresh`). Admins only. */
export const useRefreshMetrics: () => () => Promise<null> = ROOM_FEED
  ? () =>
      useCallback(async () => {
        await ask(ACCOUNT_PATHS.refreshMetrics, { body: {} })
        reload(ACCOUNT_PATHS.metrics)
        return null
      }, [])
  : () => {
      const refresh = useMutation(api.metrics.refresh)
      return useCallback(() => refresh({}), [refresh])
    }

/** The backend's build floor, from the Worker (`build.floor`'s place); `undefined` until answered. */
export function askFloor(): Promise<number | undefined> {
  return ask<number>(ACCOUNT_PATHS.floor).then(
    (floor) => (typeof floor === 'number' ? floor : undefined),
    () => undefined
  )
}
