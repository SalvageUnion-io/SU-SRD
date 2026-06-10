/**
 * Client-side preload hook for React islands.
 *
 * Islands that use salvageunion-reference ORM methods must call this hook
 * and wait for `ready` before making any ORM calls. The preload runs once
 * and is shared across all islands via the module-scoped promise.
 */
import { useState, useEffect, type ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'

let preloadPromise: Promise<void> | null = null

function ensurePreloaded(): Promise<void> {
  if (SalvageUnionReference.isLoaded('chassis')) return Promise.resolve()
  if (!preloadPromise) {
    preloadPromise = SalvageUnionReference.preload('all')
  }
  return preloadPromise
}

/**
 * @param options.defer When true, the preload does not start on mount —
 * it waits until `load()` is called (first user intent, e.g. focusing the
 * search input). Keeps the ~1.4 MB data corpus off the critical path of
 * pages that only need it on interaction. Defaults to eager preload.
 */
export function useGameData(options?: { defer?: boolean }): {
  ready: boolean
  load: () => void
} {
  const [ready, setReady] = useState(SalvageUnionReference.isLoaded('chassis'))
  const [wanted, setWanted] = useState(!options?.defer)

  useEffect(() => {
    if (ready || !wanted) return
    let cancelled = false
    ensurePreloaded().then(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [ready, wanted])

  return { ready, load: () => setWanted(true) }
}

/**
 * Gate component — renders children only after game data is preloaded.
 * Use this to wrap island content that depends on ORM calls.
 */
export function GameDataGate({
  children,
  fallback,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  const { ready } = useGameData()
  if (!ready) return fallback ?? null
  return children
}
