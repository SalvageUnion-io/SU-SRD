/**
 * Reads and writes against the site Worker's JSON routes (`worker/sharedRoutes.ts`):
 * what crosses rooms, which no one room's socket serves. Each answer is
 * `{ value }`, or `{ refusal }` with a 4xx.
 *
 * `useWorkerRead` stands in for `useQuery`: undefined while it loads, then the
 * value, kept per address for every screen that asks. A write refreshes the
 * reads it changed (`refreshWorkerReads`), since nothing pushes these.
 */

import { useEffect, useSyncExternalStore } from 'react'
import { RoomDeclined } from '../../replica/roomSocket'

const answers = new Map<string, unknown>()
const asking = new Map<string, Promise<void>>()
const listeners = new Set<() => void>()

function changed(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The value a route answered, or a throw: a refusal the player reads as `RoomDeclined`. */
async function answerOf(res: Response): Promise<unknown> {
  const body = (await res.json().catch(() => null)) as { value?: unknown; refusal?: unknown } | null
  if (res.ok) return body?.value ?? null
  if (res.status < 500 && typeof body?.refusal === 'string') throw new RoomDeclined(body.refusal)
  throw new Error(`${res.url || 'A Worker route'} answered ${res.status}`)
}

function ask(path: string): Promise<void> {
  const out = asking.get(path)
  if (out !== undefined) return out
  const next = fetch(path, { credentials: 'same-origin' })
    .then(answerOf)
    .then((value) => {
      answers.set(path, value)
      changed()
    })
    .catch(() => {
      // A read that fails keeps loading, as a query offline does; the next ask tries again.
    })
    .finally(() => asking.delete(path))
  asking.set(path, next)
  return next
}

/** One route's value: undefined while it loads (or with `null` for the path, never). */
export function useWorkerRead<T>(path: string | null): T | undefined {
  useEffect(() => {
    if (path !== null && !answers.has(path)) void ask(path)
  }, [path])
  return useSyncExternalStore(subscribe, () =>
    path === null ? undefined : (answers.get(path) as T | undefined)
  )
}

/** Ask again every held read whose address starts with `prefix`. */
export function refreshWorkerReads(prefix: string): Promise<void> {
  return Promise.all(
    [...answers.keys()].filter((path) => path.startsWith(prefix)).map((path) => ask(path))
  ).then(() => undefined)
}

/** A `POST` to one route: its value, or a throw (`RoomDeclined` for a refusal). */
export async function workerWrite<T>(path: string, body: unknown = {}): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return (await answerOf(res)) as T
}

/** Hold `value` as a route's answer without asking it: a test's stand-in server. */
export function holdWorkerRead(path: string, value: unknown): void {
  answers.set(path, value)
  changed()
}

/** Drop every held read, telling no one, so the next ask goes to the route again: a test's fresh start. */
export function forgetWorkerReads(): void {
  answers.clear()
  asking.clear()
}
