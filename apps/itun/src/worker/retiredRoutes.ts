/**
 * URLs this app used to serve and no longer does, and where each one went.
 *
 * ## One reader: the Worker
 *
 * The Worker (`./index.ts`, rule 1) answers each with a 301, so a bookmark, a
 * pasted builder link or a crawler lands on the page that replaced it rather
 * than on the SPA's not-found screen. No client-side route is needed as well —
 * there used to be four route files that existed only to `throw redirect()`
 * (audit AP-18).
 *
 * The 301 is sufficient for an installed PWA too, because the service worker
 * sends every navigation to the network before its precache
 * (`src/lib/sw/workbox.ts`). This table used to have a second reader for that
 * reason: when the service worker answered navigations from the precached
 * `index.html`, these patterns were its navigation denylist, the one way a
 * retired URL could reach the Worker at all. Network-first navigations retired
 * the denylist.
 *
 * Offline, a retired URL gets the precached shell and so the SPA's not-found
 * screen — a bookmark to a screen that no longer exists, opened with no
 * connection. The same holds under `bun run dev:itun`, where plain Vite serves
 * the SPA with no Worker in front of it. That is expected, not a regression —
 * exercise the redirects through the Worker (wrangler) or its routing tests.
 *
 * Keep the patterns anchored and specific: anything matched here is answered
 * by the Worker and bypasses the app entirely, so a loose pattern would
 * shadow a live route.
 */

type RetiredRoute = {
  /** Matched against the URL path only. */
  pattern: RegExp
  /** Where it went, built from the pattern's capture groups. */
  to: (match: RegExpExecArray) => string
}

export const RETIRED_ROUTES: readonly RetiredRoute[] = [
  // The Share Snapshot screen, removed in #793: sharing became
  // `ShareStatusDialog` over the live sheet itself, one click from here.
  {
    pattern: /^\/sheet\/([^/?]+)\/([^/?]+)\/share\/?$/,
    to: (m) => `/sheet/${m[1]}/${m[2]}`,
  },
  // The per-entity detail pages, collapsed into the live sheet. `new` (the
  // wizards) and `patterns` (the mech pattern library) are live routes under
  // the same prefixes, so both are excluded by name. (The `\?` alternative in
  // the lookahead dates from the service worker's copy of this pattern, which
  // saw the query string too; against the bare path the Worker matches it is
  // inert.)
  {
    pattern: /^\/(pilot|mech|crawler)s\/(?!(?:new|patterns)\/?(?:\?|$))([^/?]+)\/?$/,
    to: (m) => `/sheet/${m[1]}/${m[2]}`,
  },
  // The rendered og:image for a shared snapshot, retired with snapshots
  // (ADR-036). Links already posted name it in their unfurl; the app icon is
  // what that renderer always fell back to, so a re-fetching unfurl gets the
  // same picture a failed render did rather than a 404.
  {
    pattern: /^\/og\/s\/[^/]+\.png$/,
    to: () => '/icon-512.png',
  },
]

/** The destination path for a retired URL, or null when the path is live. */
export function retiredRedirect(path: string): string | null {
  for (const route of RETIRED_ROUTES) {
    const match = route.pattern.exec(path)
    if (match) return route.to(match)
  }
  return null
}
