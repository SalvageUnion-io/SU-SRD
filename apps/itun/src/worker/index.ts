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
 *   0. `/og/*.png`        → a link preview's picture (`linkPreview.ts`,
 *      issue 1280), rendered on request and cached by version.
 *   3. anything else      → the shell, `/` read through the asset binding,
 *      so a crawler or an unfurl bot opening `/p/:kind/:appId` gets the same
 *      document a browser does. `/` rather than `/index.html`, which the
 *      asset server's HTML handling may answer with a redirect to `/`. For
 *      a route a player shares (`/p/:kind/:appId`, `/join/:code`) the shell's
 *      `itun:meta` block is swapped for that thing's preview (`shellMeta.ts`):
 *      what a stranger may see, or the plain Private card.
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
 * None of these responses is a document that runs script — the shell in rule 3
 * comes back from the binding. The 404s say `no-store`: `_headers`' `/assets/*`
 * rule also reaches them in production, and a 404 pinned `immutable` outlives
 * the deploy that brings the chunk (smoke-production.sh probes it).
 */

import type { ObservabilityEnv } from 'observability/cloudflare'
import { withObservability } from 'observability/cloudflare'
import type { ImageCache, PreviewEnv } from './linkPreview'
import { isOgImagePath, metaFor, ogImage, previewRouteOf } from './linkPreview'
import { applyMeta } from './shellMeta'

export type Env = ObservabilityEnv &
  PreviewEnv & {
    /** Static assets (the built SPA), in `single-page-application` mode. */
    ASSETS: { fetch(request: Request): Promise<Response> }
  }

/** The Cache API's default cache, where the runtime has one (never under Bun). */
function defaultCache(): ImageCache | undefined {
  return (globalThis as { caches?: { default?: ImageCache } }).caches?.default
}

/** @public Cloudflare Worker entrypoint — loaded by workerd, not imported. */
export default withObservability('su-itun', {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname
    const lastSegment = path.slice(path.lastIndexOf('/') + 1)

    // 0. A link preview's picture — a file that exists only on request.
    if (isOgImagePath(path)) return ogImage(request, env, { cache: defaultCache() })

    // 1 and 2. A file that is not there — a rotated chunk above all (#759).
    if (path.startsWith('/assets/') || lastSegment.includes('.')) {
      return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } })
    }

    // 3. A client route asked for without a navigation: the shell, carrying a
    //    shared thing's preview when the route names one.
    const shell = await env.ASSETS.fetch(new Request(new URL('/', request.url), { method: 'GET' }))
    const route = previewRouteOf(path)
    if (route === null || !shell.ok) return shell
    const meta = await metaFor(route, url, env)
    if (meta === null) return shell
    const headers = new Headers(shell.headers)
    // The body changed length; the runtime recomputes it.
    headers.delete('content-length')
    return new Response(applyMeta(await shell.text(), meta), { status: shell.status, headers })
  },
})
