/**
 * The Union bar's Cantina side: its nav (`components/unionBar/UnionBar.tsx`)
 * and the rules the app applies to it (`components/shared/UnionBarSlots.tsx`).
 */
import { routeInApp } from './appBase'
import { pageOrigin } from './site'

/** The Cantina's own nav, as routes inside the app; the bar shows them under the base. */
export const CANTINA_NAV = [
  { label: 'Hangar', path: '/' },
  { label: 'Starter Set', path: '/starter/' },
] as const

/** Whether a nav route is the page you are on. */
export function isCurrent(path: string, pathname: string): boolean {
  const route = path.replace(/\/+$/, '')
  if (route === '') return pathname === '/' || pathname === ''
  return pathname === route || pathname.startsWith(`${route}/`)
}

/**
 * The route a click on one of the bar's links should take in place, or null to
 * leave it to the browser: another tool, a new tab, a modified click.
 */
export function inAppRoute(event: MouseEvent, origin: string = pageOrigin()): string | null {
  if (event.defaultPrevented || event.button !== 0) return null
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null
  const link = event.target instanceof Element ? event.target.closest('a') : null
  if (!link || link.target) return null
  const url = new URL(link.getAttribute('href') ?? '', origin)
  if (url.origin !== origin) return null
  const route = routeInApp(url.pathname)
  return route === null ? null : `${route}${url.search}${url.hash}`
}
