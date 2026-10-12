/**
 * Retired addresses that links in Discord history still point at. Each one
 * answers with a **301** to where it lives now, keeping the query string. Until
 * refit D6 these were TanStack routes that redirected in the browser; the Worker
 * does it now, so they ship in neither the route tree nor the bundle.
 *
 *   - `/games`                                → `/` (the Games page became the hub)
 *   - `/games/:gameId/view/:kind/:entityId`   → `/sheet/:kind/:entityId` (the old
 *     crew view; the live read-only sheet takes the same row id)
 *   - `/join/:code`                           → `/invite/:code` (issue 1255: an
 *     invite's token is its old join code, so the invite page joins or explains)
 *
 * A navigation never runs this script on its own (see `./index.ts`), so
 * `wrangler.jsonc`'s `run_worker_first` names these prefixes and nothing else.
 * A path under one of them that names none of these shapes is a 404: it never
 * matched a route before either. Every target is a path with no origin, so the
 * redirect stays on whatever host (or, later, base path) served it.
 *
 * `/s/:id` (ADR-036) is not here: its page explains a retired snapshot link and
 * has nowhere to send anyone, so it stays a route.
 */

/**
 * The `run_worker_first` patterns: exactly the retired addresses. The routing
 * test holds `wrangler.jsonc` equal to this list.
 */
export const RETIRED_PATTERNS = ['/games', '/games/', '/games/*/view/*', '/join/*'] as const

/** The address a retired path now lives at, without its query string, or null. */
export function retiredTarget(path: string): string | null {
  const parts = path.split('/').filter((part) => part.length > 0)
  const [first, second, third, fourth, fifth] = parts
  if (first === 'games' && parts.length === 1) return '/'
  if (first === 'games' && parts.length === 5 && third === 'view')
    return `/sheet/${fourth}/${fifth}`
  if (first === 'join' && parts.length === 2) return `/invite/${second}`
  return null
}

/** Whether a path falls under one of `RETIRED_PATTERNS`, so the Worker ran first for it. */
export function isRetiredPath(path: string): boolean {
  return (
    path === '/games' ||
    path === '/games/' ||
    /^\/games\/.+\/view\//.test(path) ||
    path.startsWith('/join/')
  )
}

/** The 301 for a retired path, or a 404 when the path names no retired shape. */
export function retiredRedirect(url: URL): Response {
  const target = retiredTarget(url.pathname)
  if (target === null) {
    return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } })
  }
  return new Response(null, { status: 301, headers: { location: `${target}${url.search}` } })
}
