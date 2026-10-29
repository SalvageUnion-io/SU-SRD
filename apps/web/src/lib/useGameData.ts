/**
 * Client-side preload hook for React islands.
 *
 * Islands that use salvageunion-reference ORM methods must call this hook
 * and wait for `ready` before making any ORM calls. Preloads are keyed by
 * their exact schema list (`'all'`, or a sorted, comma-joined array) so
 * different islands on the same page can request different subsets —
 * see `../lib/schemaPreloadDeps.ts` for how per-route lists are computed —
 * while multiple islands requesting the *same* list still share one
 * in-flight preload promise.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { getSchemaCatalog, SalvageUnionReference } from 'salvageunion-reference'

/** A preload request: every schema (`'all'`), or an explicit subset. */
export type SchemaList = string[] | 'all'

/**
 * Which copy of each schema to load: every field (`'full'`, the default), or a
 * listing's `'list'` projection — `actions` without its prose (see
 * `salvageunion-reference`'s `lib/listProjection.ts`). Only a consumer that
 * never prints an action's prose may ask for `'list'`.
 */
export type Projection = 'full' | 'list'

type PreloadState = { promise: Promise<void> | null; done: boolean }

const preloadStates = new Map<string, PreloadState>()
const readyListeners = new Map<string, Set<() => void>>()

/**
 * Test-only escape hatch: clears all module-level preload state so tests
 * that mock SalvageUnionReference.preload() don't leak state into each other.
 * Production code must never call this.
 */
export function resetPreloadForTests(): void {
  preloadStates.clear()
  readyListeners.clear()
}

/** Stable cache/listener key for a schema list — order-independent. */
function keyFor(schemas: SchemaList, projection: Projection): string {
  const list = schemas === 'all' ? 'all' : [...schemas].sort().join(',')
  return projection === 'full' ? list : `${projection}:${list}`
}

function emitReady(key: string): void {
  const listeners = readyListeners.get(key)
  if (!listeners) return
  for (const listener of listeners) listener()
}

function subscribeReady(key: string, onChange: () => void): () => void {
  let listeners = readyListeners.get(key)
  if (!listeners) {
    listeners = new Set()
    readyListeners.set(key, listeners)
  }
  listeners.add(onChange)
  // Capture the narrowed Set in a const — TS can't keep the `let` narrowed
  // inside the cleanup closure.
  const subscribed = listeners
  return () => {
    subscribed.delete(onChange)
  }
}

/**
 * True once every schema in the list has been preloaded (in that projection);
 * `'all'` means every schema in the catalog, never a sample of it.
 */
function isSchemaListLoaded(schemas: SchemaList, projection: Projection): boolean {
  const ids = schemas === 'all' ? getSchemaCatalog().schemas.map((schema) => schema.id) : schemas
  return ids.every((schema) => SalvageUnionReference.isLoaded(schema, { projection }))
}

/**
 * Client snapshot: ready once this key's shared preload has resolved (or the
 * data was already loaded at mount).
 */
function getReadySnapshot(key: string, schemas: SchemaList, projection: Projection): boolean {
  return (preloadStates.get(key)?.done ?? false) || isSchemaListLoaded(schemas, projection)
}

/**
 * Server snapshot: ALWAYS false, so `ssr: true` islands server-render the
 * fallback (SSR has no preload). Islands mount with `createRoot`, so the client
 * never uses this value for hydration.
 */
function getReadyServerSnapshot(): boolean {
  return false
}

function ensurePreloaded(key: string, schemas: SchemaList, projection: Projection): Promise<void> {
  if (isSchemaListLoaded(schemas, projection)) {
    const state = preloadStates.get(key) ?? { promise: null, done: false }
    state.done = true
    preloadStates.set(key, state)
    return Promise.resolve()
  }
  let state = preloadStates.get(key)
  if (!state) {
    state = { promise: null, done: false }
    preloadStates.set(key, state)
  }
  let promise = state.promise
  if (!promise) {
    const pending = state
    promise = SalvageUnionReference.preload(schemas, { projection }).then(() => {
      pending.done = true
      emitReady(key)
    })
    pending.promise = promise
  }
  return promise
}

/**
 * Loads a schema list ahead of an island's first render, for a mounter that
 * must not commit a fallback over server markup (`clientSwap`'s `prepare`). Shares the
 * hook's in-flight promise, so the island's own gate then opens at once. A
 * failure is swallowed and the state reset: the island mounts anyway and its
 * gate retries, showing its retry affordance if that fails too.
 */
export function preloadGameData(schemas: SchemaList, projection: Projection): Promise<void> {
  const key = keyFor(schemas, projection)
  return ensurePreloaded(key, schemas, projection).catch(() => {
    preloadStates.set(key, { promise: null, done: false })
  })
}

/**
 * @param options.schemas Which schemas to preload — defaults to `'all'`.
 * Pass the per-route list from `schemaPreloadDeps.ts` to load only what the
 * page actually needs instead of the full corpus.
 * @param options.projection `'list'` for a listing that never prints an
 * action's prose — see {@link Projection}. Defaults to `'full'`.
 */
export function useGameData(options?: { schemas?: SchemaList; projection?: Projection }): {
  ready: boolean
  error: Error | null
  retry: () => void
} {
  const schemas = options?.schemas ?? 'all'
  const projection = options?.projection ?? 'full'
  // Order-independent, primitive dependency key — safe even when callers pass
  // a fresh array literal each render (as build-time-computed props do).
  const key = keyFor(schemas, projection)

  const subscribe = useCallback((onChange: () => void) => subscribeReady(key, onChange), [key])
  const getSnapshot = useCallback(
    () => getReadySnapshot(key, schemas, projection),
    [key, schemas, projection]
  )
  // `ready` is read through useSyncExternalStore so the server always sees the
  // fallback while the client tracks the live preload state.
  const ready = useSyncExternalStore(subscribe, getSnapshot, getReadyServerSnapshot)
  const [error, setError] = useState<Error | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the stable, order-independent identity of `schemas` and `projection` — depending on the (often fresh-per-render) array itself would re-run the effect every render
  useEffect(() => {
    // After a failure, `error` blocks re-fetching until retry() clears it —
    // clearing it re-runs this effect, which retries the (reset) preload.
    if (ready || error) return
    let cancelled = false
    ensurePreloaded(key, schemas, projection).catch((e: unknown) => {
      // Reset this key's state so a retry issues a fresh request instead of
      // re-awaiting the same rejection.
      preloadStates.set(key, { promise: null, done: false })
      if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)))
    })
    return () => {
      cancelled = true
    }
  }, [ready, error, key])

  const retry = useCallback(() => setError(null), [])

  return { ready, error, retry }
}
