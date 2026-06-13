/**
 * Client-side preload hook for React islands.
 *
 * Islands that use salvageunion-reference ORM methods must call this hook
 * and wait for `ready` before making any ORM calls. The preload runs once
 * and is shared across all islands via the module-scoped promise.
 */
import { useState, useEffect, useCallback, useSyncExternalStore, type ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'

let preloadPromise: Promise<void> | null = null
let preloadDone = false
const readyListeners = new Set<() => void>()

/**
 * Test-only escape hatch: clears the module-level preload state so tests
 * that mock SalvageUnionReference.preload() don't leak state into each other.
 * Production code must never call this.
 */
export function resetPreloadForTests(): void {
  preloadPromise = null
  preloadDone = false
}

function emitReady(): void {
  for (const listener of readyListeners) listener()
}

function subscribeReady(onChange: () => void): () => void {
  readyListeners.add(onChange)
  return () => {
    readyListeners.delete(onChange)
  }
}

/**
 * Client snapshot: ready once the shared preload has resolved (or the data was
 * already loaded at mount).
 */
function getReadySnapshot(): boolean {
  return preloadDone || SalvageUnionReference.isLoaded('chassis')
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

function ensurePreloaded(): Promise<void> {
  if (SalvageUnionReference.isLoaded('chassis')) {
    preloadDone = true
    return Promise.resolve()
  }
  if (!preloadPromise) {
    preloadPromise = SalvageUnionReference.preload('all').then(() => {
      preloadDone = true
      emitReady()
    })
  }
  return preloadPromise
}

/**
 * @param options.defer When true, the preload does not start on mount —
 * it waits until `load()` is called (first user intent, e.g. focusing the
 * search input). Keeps the ~1.4 MB data corpus off the critical path of
 * pages that only need it on interaction. Defaults to eager preload.
 *
 * Note: the preload promise is module-shared, so `defer` only keeps data off
 * the critical path on pages that render *no* eager consumer. On a page that
 * also mounts an eager `useGameData()` (e.g. item pages with a
 * ReferenceEntityIsland, which need the entity immediately), that eager
 * consumer starts the shared preload on mount and the deferred consumer simply
 * rides the in-flight promise — by design, not a missed optimization.
 */
export function useGameData(options?: { defer?: boolean }): {
  ready: boolean
  error: Error | null
  load: () => void
} {
  // `ready` is read through useSyncExternalStore so the server (and the first
  // hydration render) always sees the fallback while the client tracks the live
  // preload state — keeping hydration consistent without seeding state from a
  // client-only value during render.
  const ready = useSyncExternalStore(subscribeReady, getReadySnapshot, getReadyServerSnapshot)
  const [wanted, setWanted] = useState(!options?.defer)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // After a failure, `error` blocks re-fetching until load() clears it —
    // clearing it re-runs this effect, which retries the (reset) preload.
    if (ready || !wanted || error) return
    let cancelled = false
    ensurePreloaded().catch((e: unknown) => {
      // Reset the module-level promise so a retry issues a fresh request
      // instead of re-awaiting the same rejection.
      preloadPromise = null
      if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)))
    })
    return () => {
      cancelled = true
    }
  }, [ready, wanted, error])

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
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  const { ready, error, load } = useGameData()
  if (error) {
    return (
      <div className="flex flex-col items-start gap-3 p-4">
        <p className="text-sm">Failed to load game data.</p>
        <button type="button" className="btn btn-inactive" onClick={load}>
          Retry loading game data
        </button>
      </div>
    )
  }
  if (!ready) return fallback ?? null
  return children
}
