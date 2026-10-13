/**
 * ITUN at salvageunion.io/build (ADR-048) — the SPA on Workers Static Assets,
 * in `single-page-application` mode, on a Workers route (`salvageunion.io/build*`)
 * that runs ahead of su-srd's Custom Domain. It also keeps intheunionnow.com
 * and its `www`, where ITUN lived before, to redirect them.
 *
 * ## What reaches this script, and what does not
 *
 * `run_worker_first` is every path EXCEPT `/build/*`, so:
 *
 *   L. outside the base   → this script first: intheunionnow.com 301s to the
 *      same page under salvageunion.io/build; anything else is ITUN's root
 *      (a 301 to `/build/`) or a 404 (`legacyHost.ts`).
 *
 * Under `/build/`, Static Assets answers first, with `_headers` applied (every
 * security header and the CSP live there; the build moves it to `dist/`):
 *
 *   - a real file          → served as itself;
 *   - a NAVIGATION miss    → `index.html`, 200 (`Sec-Fetch-Mode: navigate`,
 *     which every browser sends when it opens a page). Navigations never run
 *     this script.
 *
 * Otherwise only a miss WITHOUT `Sec-Fetch-Mode: navigate` lands here: a
 * module import, a `fetch`, a crawler, an unfurl bot. This script reads the
 * path inside the base (`basePath.ts`) and answers it:
 *
 *   1. `/assets/*`        → **404**, never the shell.
 *   2. a missing FILE     → **404**: a dot in the last segment.
 *   0. `/og/*.png`        → a link preview's picture (`linkPreview.ts`),
 *      rendered on request and cached by version.
 *   3. anything else      → the shell, `/build/` read through the asset
 *      binding, so a crawler or an unfurl bot opening `/build/p/:kind/:appId`
 *      gets the same document a browser does. The directory rather than
 *      `index.html`, which the asset server's HTML handling may answer with a
 *      redirect. For a route a player shares (`/p/:kind/:appId`,
 *      `/invite/:token`) the shell's `itun:meta` block is swapped for that
 *      thing's preview (`shellMeta.ts`): what a stranger may see, or the plain
 *      Private card.
 *
 * ## Rule 1 is the one that has already broken production
 *
 * Every hashed chunk a deploy rotates away is requested by exactly one
 * population: clients still running the previous build, by module import,
 * never by navigation. When those requests got `200 text/html`, the import
 * rejected on MIME type and the `immutable` header pinned that HTML into the
 * HTTP cache **for a year** under the chunk's URL. An honest 404 makes
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
import { pathInApp } from './basePath'
import { inBase, outsideBase } from './legacyHost'
import type { ImageCache, PreviewEnv } from './linkPreview'
import { isOgImagePath, metaFor, ogImage, previewRouteOf } from './linkPreview'
import { applyMeta } from './shellMeta'

export type Env = ObservabilityEnv &
  PreviewEnv & {
    /** Static assets (the built SPA), in `single-page-application` mode. */
    ASSETS: { fetch(request: Request): Promise<Response> }
    /**
     * The path ITUN is served under, without a trailing slash: `/build`
     * (`wrangler.jsonc`, held equal to `SITE.base` by the routing test).
     */
    BASE_PATH: string
  }

/** The Cache API's default cache, where the runtime has one (never under Bun). */
function defaultCache(): ImageCache | undefined {
  return (globalThis as { caches?: { default?: ImageCache } }).caches?.default
}

/** @public Cloudflare Worker entrypoint — loaded by workerd, not imported. */
export default withObservability('su-itun', {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const base = env.BASE_PATH

    // L. Outside the base: the old host's 301s, or ITUN's root (`legacyHost.ts`).
    //    `run_worker_first` routes every such request here first.
    if (!inBase(url.pathname, base)) return outsideBase(url, base)

    // Every rule below reads the path inside the app; a URL it builds puts the
    // base back.
    const path = pathInApp(url.pathname, base)
    const lastSegment = path.slice(path.lastIndexOf('/') + 1)

    // 0. A link preview's picture — a file that exists only on request.
    if (isOgImagePath(path)) return ogImage(request, env, { cache: defaultCache(), base })

    // 1 and 2. A file that is not there — a rotated chunk above all.
    if (path.startsWith('/assets/') || lastSegment.includes('.')) {
      return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } })
    }

    // 3. A client route asked for without a navigation: the shell, carrying a
    //    shared thing's preview when the route names one.
    const shell = await env.ASSETS.fetch(
      new Request(new URL(`${base}/`, request.url), { method: 'GET' })
    )
    const route = previewRouteOf(path)
    if (route === null || !shell.ok) return shell
    const meta = await metaFor(route, url, env, fetch, base)
    if (meta === null) return shell
    const headers = new Headers(shell.headers)
    // The body changed length; the runtime recomputes it.
    headers.delete('content-length')
    return new Response(applyMeta(await shell.text(), meta), { status: shell.status, headers })
  },
})
