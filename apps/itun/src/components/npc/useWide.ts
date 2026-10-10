import { useSyncExternalStore } from 'react'

/** The breakpoint the NPC designer's two columns start at (`styles/npc.css`). */
const WIDE_QUERY = '(min-width: 48rem)'

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => undefined
  const query = window.matchMedia(WIDE_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/**
 * Whether the viewport has room for the designer's two columns. Below it the
 * crew slot form opens in a full-height modal (§5). With no `matchMedia` (a
 * test DOM, an old engine) it answers wide, the layout that loses nothing.
 */
export function useWide(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => typeof window.matchMedia !== 'function' || window.matchMedia(WIDE_QUERY).matches,
    () => true
  )
}
