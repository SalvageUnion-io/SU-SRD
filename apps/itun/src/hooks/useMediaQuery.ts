import { useCallback, useSyncExternalStore } from 'react'

/**
 * Whether the viewport matches `query`. With no `matchMedia` (a test DOM, an
 * old engine) it answers true — callers pass a min-width query, so that is the
 * wide layout, the one that loses nothing.
 */
export function useMediaQuery(query: string): boolean {
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
    () => typeof window.matchMedia !== 'function' || window.matchMedia(query).matches,
    () => true
  )
}
