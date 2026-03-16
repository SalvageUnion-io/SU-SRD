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

export function useGameData(): { ready: boolean } {
  const [ready, setReady] = useState(SalvageUnionReference.isLoaded('chassis'))

  useEffect(() => {
    if (ready) return
    ensurePreloaded().then(() => setReady(true))
  }, [ready])

  return { ready }
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
