/**
 * Client-side loader for the build-time compact search index
 * (`search-index.json.ts`). Mirrors `useGameData.ts`'s SSR-safe,
 * shared-promise pattern, but fetches a small static JSON asset instead of
 * preloading the ORM — search islands never import `salvageunion-reference`.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { CompactSearchEntry } from './searchIndexTypes'
import type { SearchNameRow } from './searchNames'
import { namesIndex } from './searchNames'

let indexPromise: Promise<CompactSearchEntry[]> | null = null
let indexData: CompactSearchEntry[] | null = null
/** The names alone (`/search-names.json`), a few kilobytes: matched while the index loads (r8 G1). */
let namesPromise: Promise<void> | null = null
let namesData: CompactSearchEntry[] | null = null
const readyListeners = new Set<() => void>()

/** Test-only escape hatch, mirroring `resetPreloadForTests` in useGameData.ts. */
export function resetSearchIndexForTests(): void {
  indexPromise = null
  indexData = null
  namesPromise = null
  namesData = null
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

function getNamesSnapshot(): CompactSearchEntry[] | null {
  return namesData
}

function getNamesServerSnapshot(): CompactSearchEntry[] | null {
  return null
}

/** The names, fetched beside the index; a failure leaves the index to answer alone. */
function ensureNames(): void {
  if (namesPromise || indexData) return
  namesPromise = fetch('/search-names.json')
    .then((res) => (res.ok ? (res.json() as Promise<SearchNameRow[]>) : null))
    .then((rows) => {
      if (!rows || indexData) return
      namesData = namesIndex(rows)
      emitReady()
    })
    .catch(() => {
      // Offline or refused: the whole index is what answers.
    })
}

/** Server snapshot: always false — see useGameData.ts's identical rationale
 *  (SSR/first-hydration-render consistency; no fetch happens on the server). */
function getReadyServerSnapshot(): boolean {
  return false
}

function ensureLoaded(): Promise<CompactSearchEntry[]> {
  if (indexData) return Promise.resolve(indexData)
  if (!indexPromise) {
    indexPromise = fetch('/search-index.json')
      .then((res) => {
        if (!res.ok) throw new Error(`The search index could not be loaded: ${res.status}`)
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
 * search input).
 */
export function useSearchIndex(options?: { defer?: boolean; names?: boolean }): {
  ready: boolean
  error: Error | null
  index: CompactSearchEntry[]
  /** With `names`: every entry's name, matched while `index` loads (r8 G1); empty until it lands. */
  names: CompactSearchEntry[]
  load: () => void
} {
  const ready = useSyncExternalStore(subscribeReady, getReadySnapshot, getReadyServerSnapshot)
  const names = useSyncExternalStore(subscribeReady, getNamesSnapshot, getNamesServerSnapshot)
  const withNames = options?.names === true
  const [wanted, setWanted] = useState(!options?.defer)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (ready || !wanted || error) return
    if (withNames) ensureNames()
    let cancelled = false
    ensureLoaded().catch((e: unknown) => {
      indexPromise = null
      if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)))
    })
    return () => {
      cancelled = true
    }
  }, [ready, wanted, error, withNames])

  const load = useCallback(() => {
    setWanted(true)
    setError(null)
  }, [])

  return { ready, error, index: indexData ?? [], names: names ?? [], load }
}
