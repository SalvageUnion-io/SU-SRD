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
import { useState, useEffect, useCallback, useSyncExternalStore, type ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Button } from 'component-lib'

/** A preload request: every schema (`'all'`), or an explicit subset. */
export type SchemaList = string[] | 'all'

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
function keyFor(schemas: SchemaList): string {
  return schemas === 'all' ? 'all' : [...schemas].sort().join(',')
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

/** True once every schema in the list has been preloaded. */
function isSchemaListLoaded(schemas: SchemaList): boolean {
  if (schemas === 'all') return SalvageUnionReference.isLoaded('chassis')
  return schemas.every((schema) => SalvageUnionReference.isLoaded(schema))
}

/**
 * Client snapshot: ready once this key's shared preload has resolved (or the
 * data was already loaded at mount).
 */
function getReadySnapshot(key: string, schemas: SchemaList): boolean {
  return (preloadStates.get(key)?.done ?? false) || isSchemaListLoaded(schemas)
}

/**
 * Server snapshot: ALWAYS false. SSR has no preloaded data and runs no effects,
 * so islands must server-render the fallback. React reuses this value for the
 * first client (hydration) render too, so the initial client tree matches the
 * SSR HTML — reading the live load state here instead caused a hydration
 * mismatch (React #418) on islands that hydrate after the shared preload
 * finished (client:idle / client:visible).
 */
function getReadyServerSnapshot(): boolean {
  return false
}

function ensurePreloaded(key: string, schemas: SchemaList): Promise<void> {
  if (isSchemaListLoaded(schemas)) {
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
    promise = SalvageUnionReference.preload(schemas).then(() => {
      pending.done = true
      emitReady(key)
    })
    pending.promise = promise
  }
  return promise
}

/**
 * @param options.defer When true, the preload does not start on mount —
 * it waits until `load()` is called (first user intent, e.g. focusing the
 * search input). Keeps the data corpus off the critical path of pages that
 * only need it on interaction. Defaults to eager preload.
 * @param options.schemas Which schemas to preload — defaults to `'all'`.
 * Pass the per-route list from `schemaPreloadDeps.ts` to load only what the
 * page actually needs instead of the full corpus.
 *
 * Note: the preload promise is shared per exact schema list, so `defer` only
 * keeps data off the critical path on pages that render *no* eager consumer
 * requesting an overlapping list. On a page that also mounts an eager
 * `useGameData()` for the same list, that eager consumer starts the shared
 * preload on mount and the deferred consumer simply rides the in-flight
 * promise — by design, not a missed optimization.
 */
export function useGameData(options?: { defer?: boolean; schemas?: SchemaList }): {
  ready: boolean
  error: Error | null
  load: () => void
} {
  const schemas = options?.schemas ?? 'all'
  // Order-independent, primitive dependency key — safe even when callers pass
  // a fresh array literal each render (as build-time-computed props do).
  const key = keyFor(schemas)

  const subscribe = useCallback((onChange: () => void) => subscribeReady(key, onChange), [key])
  const getSnapshot = useCallback(() => getReadySnapshot(key, schemas), [key, schemas])
  // `ready` is read through useSyncExternalStore so the server (and the first
  // hydration render) always sees the fallback while the client tracks the live
  // preload state — keeping hydration consistent without seeding state from a
  // client-only value during render.
  const ready = useSyncExternalStore(subscribe, getSnapshot, getReadyServerSnapshot)
  const [wanted, setWanted] = useState(!options?.defer)
  const [error, setError] = useState<Error | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the stable, order-independent identity of `schemas` — depending on the (often fresh-per-render) array itself would re-run the effect every render
  useEffect(() => {
    // After a failure, `error` blocks re-fetching until load() clears it —
    // clearing it re-runs this effect, which retries the (reset) preload.
    if (ready || !wanted || error) return
    let cancelled = false
    ensurePreloaded(key, schemas).catch((e: unknown) => {
      // Reset this key's state so a retry issues a fresh request instead of
      // re-awaiting the same rejection.
      preloadStates.set(key, { promise: null, done: false })
      if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)))
    })
    return () => {
      cancelled = true
    }
  }, [ready, wanted, error, key])

  // Stable identity: consumers (e.g. SearchIsland) put `load` in callback
  // dependency arrays, so recreating it each render would churn their memoized
  // handlers. setWanted/setError are stable, so [] deps are correct.
  const load = useCallback(() => {
    setWanted(true)
    setError(null)
  }, [])

  return { ready, error, load }
}

/**
 * Gate component — renders children only after game data is preloaded.
 * Use this to wrap island content that depends on ORM calls.
 * On preload failure it renders a retry affordance instead of the fallback,
 * so a network error never leaves a permanent skeleton.
 */
export function GameDataGate({
  children,
  fallback,
  schemas,
}: {
  children: ReactNode
  fallback?: ReactNode
  /** Which schemas to preload — defaults to `'all'`. See `useGameData`. */
  schemas?: SchemaList
}) {
  // useGameData keys its preload effect off `keyFor(schemas)` (content-, not
  // reference-based), so a fresh `[...]` array literal each render is safe.
  const { ready, error, load } = useGameData({ schemas })
  if (error) {
    return (
      <div className="flex flex-col items-start gap-3 p-4">
        <p className="text-sm">Failed to load game data.</p>
        <Button variant="ghost" onClick={load}>
          Retry loading game data
        </Button>
      </div>
    )
  }
  if (!ready) return fallback ?? null
  return children
}
