/**
 * Retired addresses that links in Discord history still point at, all on
 * intheunionnow.com. These were once TanStack routes that redirected in the
 * browser. intheunionnow.com's zone Redirect Rule sends every path to the same
 * path under salvageunion.io/build, and the Worker (`index.ts`) 301s each of
 * these from there to where it lives now:
 *
 *   - `/games`                                → `/` (the Games page became the hub)
 *   - `/games/:gameId/view/:kind/:entityId`   → `/sheet/:kind/:entityId` (the old
 *     crew view; the live read-only sheet takes the same row id)
 *   - `/join/:code`                           → `/invite/:code` (an invite's
 *     token is its old join code, so the invite page joins or explains)
 *
 * A path under one of these prefixes that names none of these shapes keeps its
 * own path: it never matched a route before either, and lands on the app's
 * not-found page.
 *
 * `/s/:id` (ADR-036) is not here: its page explains a retired snapshot link and
 * has nowhere to send anyone, so it stays a route.
 */

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
