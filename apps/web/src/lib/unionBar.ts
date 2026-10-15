/**
 * The rules the Cantina applies to the shell's Union bar
 * (`components/shared/UnionBarSlots.tsx`).
 */
import { BASE_PATH } from './appUrl'

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
export function inAppRoute(
  event: MouseEvent,
  base: string = BASE_PATH,
  origin: string = window.location.origin
): string | null {
  if (event.defaultPrevented || event.button !== 0) return null
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null
  const link = event.target instanceof Element ? event.target.closest('a') : null
  if (!link || link.target) return null
  const url = new URL(link.getAttribute('href') ?? '', origin)
  if (url.origin !== origin) return null
  if (url.pathname !== base && !url.pathname.startsWith(`${base}/`)) return null
  return `${url.pathname.slice(base.length) || '/'}${url.search}${url.hash}`
}
