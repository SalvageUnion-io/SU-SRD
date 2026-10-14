import { useCallback, useSyncExternalStore } from 'react'

/**
 * Whether the viewport matches `query`, re-rendering only when it flips.
 *
 * `fallback` is the answer wherever there is no live viewport to ask: the
 * server render and the hydration pass that must match it, and a DOM with no
 * `matchMedia` (a test DOM, an old engine). It defaults to true, because most
 * callers pass a min-width query and the wide layout is the one that loses
 * nothing; a caller whose server markup must be the narrow layout (a band, one
 * column) passes false.
 */
export function useMediaQuery(query: string, fallback = true): boolean {
  // Stable per query, so useSyncExternalStore does not resubscribe each render.
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window.matchMedia !== 'function') return () => undefined
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query]
  )
  return useSyncExternalStore(
    subscribe,
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : fallback),
    () => fallback
  )
}
