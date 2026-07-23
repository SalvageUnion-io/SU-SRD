/**
 * Client-side loader for the build-time compact search index
 * (`search-index.json.ts`). Mirrors `useGameData.tsx`'s SSR-safe,
 * shared-promise pattern, but fetches a small static JSON asset instead of
 * preloading the ORM — search islands never import `salvageunion-reference`.
 */
import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'
import type { CompactSearchEntry } from './searchIndexTypes'

let indexPromise: Promise<CompactSearchEntry[]> | null = null
let indexData: CompactSearchEntry[] | null = null
const readyListeners = new Set<() => void>()

/** Test-only escape hatch, mirroring `resetPreloadForTests` in useGameData.tsx. */
export function resetSearchIndexForTests(): void {
  indexPromise = null
  indexData = null
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

function getReadySnapshot(): boolean {
  return indexData !== null
}

/** Server snapshot: always false — see useGameData.tsx's identical rationale
 *  (SSR/first-hydration-render consistency; no fetch happens on the server). */
function getReadyServerSnapshot(): boolean {
  return false
}

function ensureLoaded(): Promise<CompactSearchEntry[]> {
  if (indexData) return Promise.resolve(indexData)
  if (!indexPromise) {
    indexPromise = fetch('/search-index.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load search index: ${res.status}`)
        return res.json() as Promise<CompactSearchEntry[]>
      })
      .then((data) => {
        indexData = data
        emitReady()
        return data
      })
  }
  return indexPromise
}

/**
 * @param options.defer When true, the fetch does not start on mount — it
 * waits until `load()` is called (first user intent, e.g. focusing the
 * search input). Mirrors `useGameData`'s `defer` option.
 */
export function useSearchIndex(options?: { defer?: boolean }): {
  ready: boolean
  error: Error | null
  index: CompactSearchEntry[]
  load: () => void
} {
  const ready = useSyncExternalStore(subscribeReady, getReadySnapshot, getReadyServerSnapshot)
  const [wanted, setWanted] = useState(!options?.defer)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (ready || !wanted || error) return
    let cancelled = false
    ensureLoaded().catch((e: unknown) => {
      indexPromise = null
      if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)))
    })
    return () => {
      cancelled = true
    }
  }, [ready, wanted, error])

  const load = useCallback(() => {
    setWanted(true)
    setError(null)
  }, [])

  return { ready, error, index: indexData ?? [], load }
}
