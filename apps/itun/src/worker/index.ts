/**
 * intheunionnow.com — the ITUN SPA on Workers Static Assets (ADR-033), in
 * `single-page-application` mode.
 *
 * ## What reaches this script, and what does not
 *
 * Static Assets answers first, with `public/_headers` applied (every security
 * header and the CSP live there):
 *
 *   - a real file          → served as itself;
 *   - a NAVIGATION miss    → `index.html`, 200 (`Sec-Fetch-Mode: navigate`,
 *     which every browser sends when it opens a page). Navigations never run
 *     this script.
 *
 * Only a miss WITHOUT `Sec-Fetch-Mode: navigate` lands here: a module import, a
 * `fetch`, a crawler, an unfurl bot. This script answers it:
 *
 *   1. `/assets/*`        → **404**, never the shell.
 *   2. a missing FILE     → **404**: a dot in the last segment.
 *   3. anything else      → the shell, `/` read through the asset binding,
 *      so a crawler or an unfurl bot opening `/p/:kind/:appId` gets the same
 *      document a browser does. `/` rather than `/index.html`, which the
 *      asset server's HTML handling may answer with a redirect to `/`.
 *
 * ## Rule 1 is the one that has already broken production
 *
 * Every hashed chunk a deploy rotates away is requested by exactly one
 * population: clients still running the previous build, by module import,
 * never by navigation. When those requests got `200 text/html`, the import
 * rejected on MIME type and the `immutable` header pinned that HTML into the
 * HTTP cache **for a year** under the chunk's URL (#759). An honest 404 makes
 * the failed import surface as `vite:preloadError`, which `installChunkRecovery`
 * (`observability/browser`) recovers from with a single reload.
 *
 * ## Rule 2
 *
 * A client route in this app never has a file extension — they are
 * `/pilots/new`, `/sheet/$kind/$id`, `/p/$kind/$appId`. So a dot in the last
 * segment means the request wanted a FILE, and a file that is not there is a
 * 404 rather than an indexable soft-404 for every crawler that asks for
 * `/sitemap.xml` or `/favicon.ico`.
 *
 * Responses built here are not given `_headers`; none of them is a document
 * that runs script — the shell in rule 3 comes back from the binding.
 */

import type { ObservabilityEnv } from 'observability/cloudflare'
import { withObservability } from 'observability/cloudflare'

export type Env = ObservabilityEnv & {
  /** Static assets (the built SPA), in `single-page-application` mode. */
  ASSETS: { fetch(request: Request): Promise<Response> }
}

/** @public Cloudflare Worker entrypoint — loaded by workerd, not imported. */
export default withObservability('su-itun', {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname
    const lastSegment = path.slice(path.lastIndexOf('/') + 1)

    // 1 and 2. A file that is not there — a rotated chunk above all (#759).
    if (path.startsWith('/assets/') || lastSegment.includes('.')) {
      return new Response('Not found', { status: 404 })
    }

    // 3. A client route asked for without a navigation: the shell.
    return env.ASSETS.fetch(new Request(new URL('/', request.url), { method: 'GET' }))
  },
})
