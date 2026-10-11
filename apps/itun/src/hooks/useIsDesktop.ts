import { useSyncExternalStore } from 'react'

/** The Union bar's desktop layout starts here (`lg`, 64rem): below it, the drawer. */
const DESKTOP_QUERY = '(min-width: 64rem)'

function subscribeDesktop(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => undefined
  const query = window.matchMedia(DESKTOP_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** Whether the viewport is wide enough for the bar's desktop layout. */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => typeof window.matchMedia !== 'function' || window.matchMedia(DESKTOP_QUERY).matches,
    () => true
  )
}
