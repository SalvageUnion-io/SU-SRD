/**
 * URLs this app used to serve and no longer does, and where each one went.
 *
 * ## One table, two readers
 *
 * - **The Worker** (`./index.ts`, rule 1) answers each with a 301, so a
 *   bookmark, a pasted builder link or a crawler lands on the page that
 *   replaced it rather than on the SPA's not-found screen.
 * - **The service worker** (`vite.config.ts`, `navigateFallbackDenylist`) is
 *   told to leave these navigations alone. That half is what makes the 301
 *   sufficient. The SW registers a `NavigationRoute` bound to the precached
 *   `index.html`, so for anyone with the app installed or cached, a navigation
 *   is answered from Cache Storage and never reaches the Worker. Without the
 *   denylist, every retired URL needed a client-side route as well — four
 *   route files that existed only to `throw redirect()` (audit AP-18). With it,
 *   the navigation goes to the network, the Worker redirects it, and the SPA
 *   router never sees the old path.
 *
 *   The price is offline: a retired URL opened with no connection gets the
 *   browser's offline page rather than the sheet. That is a bookmark to a
 *   screen that no longer exists, opened offline, and it is the right trade
 *   for not carrying a route per retired URL forever.
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
  // the same prefixes, so both are excluded by name (followed by `?` too,
  // because the service worker's copy of this pattern also sees the query).
  {
    pattern: /^\/(pilot|mech|crawler)s\/(?!(?:new|patterns)\/?(?:\?|$))([^/?]+)\/?$/,
    to: (m) => `/sheet/${m[1]}/${m[2]}`,
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

/**
 * The patterns, for the service worker's navigation denylist.
 *
 * Workbox tests a denylist entry against the pathname AND the query string,
 * where the Worker matches the pathname alone, so each pattern's closing `$`
 * is widened to admit an optional `?…`. Without that, `/pilots/abc?x=1` would
 * be answered from the precache and land on the not-found screen.
 */
export const RETIRED_NAVIGATIONS: readonly RegExp[] = RETIRED_ROUTES.map(
  (r) => new RegExp(r.pattern.source.replace(/\$$/, '(?:\\?.*)?$'))
)
