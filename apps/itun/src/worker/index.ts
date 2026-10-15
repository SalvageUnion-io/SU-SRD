/**
 * ITUN at salvageunion.io/build (ADR-048) — the SPA on Workers Static Assets,
 * in `single-page-application` mode, on a Workers route (`salvageunion.io/build*`)
 * that runs ahead of su-srd's Custom Domain. It also keeps intheunionnow.com
 * and its `www`, where ITUN lived before, to redirect them.
 *
 * ## Every request reaches this script first
 *
 * `run_worker_first` is `true` (`RUN_WORKER_FIRST` in `legacyHost.ts`). It
 * cannot be narrower. In a pattern list, a request matching a negative pattern
 * (`!/build/*`) goes straight to the assets, ahead of every positive one, and a
 * list switches off the `Sec-Fetch-Mode: navigate` split, so every miss it
 * leaves to the assets is answered with the shell. Patterns are `*` globs only,
 * so no list both keeps navigations asset-first and sends a missing
 * `/build/assets/*` here; `["/*", "!/build/*"]` answered a rotated chunk
 * `200 text/html`, pinned `immutable` by `_headers`.
 *
 *   L. outside the base   → intheunionnow.com 301s to the same page under
 *      salvageunion.io/build; anything else is ITUN's root (a 301 to `/build/`)
 *      or a 404 (`legacyHost.ts`). None of it touches the asset binding.
 *
 * Under `/build/` this script reads the path inside the base (`basePath.ts`):
 *
 *   E. `POST /__errors`, `POST /__convex-logs` → the browser's error reports
 *      and Convex's log stream, logged for Workers Issues
 *      (`observability/cloudflare`).
 *   D. `/about`, `/changelog` → a 301 to the SRD's page (`docPages.ts`); ITUN
 *      keeps no copy of the doc pages both tools share.
 *   0. `/og/*.png`        → a link preview's picture (`linkPreview.ts`),
 *      rendered on request and cached by version.
 *   S. `/sitemap.xml`     → the public pages' urlset (`publicPages.ts`), which
 *      the SRD's `sitemap-index.xml` lists.
 *   1. `/assets/*`, or a dot in the last segment: a FILE, asked of the asset
 *      binding. A file that is there comes back as itself. A file that is not
 *      comes back from the binding as the shell (SPA mode answers every miss
 *      with `index.html`), and this script answers **404**, `no-store`, instead.
 *   2. a shared thing's route (`/p/:kind/:appId`, `/invite/:token`) asked for
 *      without `Sec-Fetch-Mode: navigate` — a crawler, an unfurl bot → the
 *      shell with its `itun:meta` block swapped for that thing's preview
 *      (`shellMeta.ts`): what a stranger may see, or the plain Private card.
 *      The shell is `/build/` read through the binding — the directory rather
 *      than `index.html`, which the asset server's HTML handling may answer
 *      with a redirect. A public page (the front door, `/starter` and each
 *      Starter Set build, `publicPages.ts`) asked for the same way gets the
 *      shell with its own title, description, canonical and `og:*`.
 *   3. anything else      → the binding's answer: the shell for a navigation
 *      to any client route.
 *
 * Rules 2 and 3 answer with the shell, and every client route but the public
 * ones (`indexable`) carries `X-Robots-Tag: noindex`: a game, a pilot's sheet
 * or a sign-in screen is a private or empty page to a crawler, all under the
 * shell's one title. Unfurls are unaffected; noindex only keeps them out of
 * search results.
 *
 * `_headers` (every security header and the CSP; the build moves it to
 * `dist/`) is applied by the asset server, so it reaches whatever the binding
 * answers — rules 1 to 3; rule 2's swap keeps the shell's headers. What this
 * script builds itself (the 404s, the 301s, the picture) runs no script.
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
 * A client route in this app never has a file extension — they are
 * `/pilots/new`, `/sheet/$kind/$id`, `/p/$kind/$appId`. So a dot in the last
 * segment means the request wanted a FILE, and a file that is not there is a
 * 404 rather than an indexable soft-404 for every crawler that asks for
 * `/sitemap.xml` or `/favicon.ico`. The shell is the only HTML the binding
 * answers `200` for such a path: a real `.html` file is answered with a
 * redirect to its pretty URL. The 404s say `no-store`: a 404 pinned in a cache
 * outlives the deploy that brings the chunk (smoke-production.sh probes it).
 */

import type { RateLimiter } from 'observability/cloudflare'
import {
  CONVEX_LOG_STREAM_PATH,
  ERROR_REPORT_PATH,
  handleConvexLogStream,
  handleErrorReport,
} from 'observability/cloudflare'
import { retiredDocPage } from '../lib/docPages'
import { pathInApp } from './basePath'
import { inBase, outsideBase } from './legacyHost'
import type { ImageCache, PreviewEnv, PreviewRoute } from './linkPreview'
import { isOgImagePath, metaFor, ogImage, previewRouteOf } from './linkPreview'
import type { PublicPage } from './publicPages'
import { publicMeta, publicPageOf, publicUrl, SITEMAP_PATH, sitemap } from './publicPages'
import { applyCanonical, applyMeta } from './shellMeta'

export type Env = PreviewEnv & {
  /**
   * Static assets (the built SPA), in `single-page-application` mode: a miss
   * is answered with the shell. `_headers` applies to every answer.
   */
  ASSETS: { fetch(request: Request): Promise<Response> }
  /**
   * The path ITUN is served under, without a trailing slash: `/build`
   * (`wrangler.jsonc`, held equal to `SITE.base` by the routing test).
   */
  BASE_PATH: string
  /**
   * The SRD a Worker Preview's redirects go to: the same PR's SRD Preview,
   * passed by `deploy-preview.yml`. Unset in production, which sends them to
   * salvageunion.io.
   */
  SRD_ORIGIN?: string
  /** Caps error reports per address (`wrangler.jsonc`); absent in a Preview. */
  ERROR_REPORT_LIMIT?: RateLimiter
  /**
   * The Convex log stream's webhook secret, from the Convex dashboard. Set
   * with `wrangler secret put`; unset, the stream endpoint answers 503.
   */
  CONVEX_LOG_STREAM_SECRET?: string
}

/** The Cache API's default cache, where the runtime has one (never under Bun). */
function defaultCache(): ImageCache | undefined {
  return (globalThis as { caches?: { default?: ImageCache } }).caches?.default
}

/** @public Cloudflare Worker entrypoint — loaded by workerd, not imported. */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const base = env.BASE_PATH

    // L. Outside the base: the old host's 301s, or ITUN's root (`legacyHost.ts`).
    if (!inBase(url.pathname, base)) return outsideBase(url, base)

    // Every rule below reads the path inside the app; a URL it builds puts the
    // base back.
    const path = pathInApp(url.pathname, base)

    // E. Errors from elsewhere, logged for Workers Issues: the browser's, and
    // Convex's through its log stream (`observability/cloudflare`).
    if (path === ERROR_REPORT_PATH) {
      return handleErrorReport(request, { app: 'itun', limiter: env.ERROR_REPORT_LIMIT })
    }
    if (path === CONVEX_LOG_STREAM_PATH) {
      return handleConvexLogStream(request, env.CONVEX_LOG_STREAM_SECRET)
    }

    // D. A doc page ITUN no longer has: the SRD's, where both tools share it.
    const docPage = retiredDocPage(path, env.SRD_ORIGIN)
    if (docPage !== null) return Response.redirect(docPage, 301)

    // 0. A link preview's picture — a file that exists only on request.
    if (isOgImagePath(path)) return ogImage(request, env, { cache: defaultCache(), base })

    // S. The public pages' sitemap — a file that exists only on request.
    if (path === SITEMAP_PATH) return sitemap(url.origin, base)

    // 1. A FILE: itself, or a 404 — never the shell. A rotated chunk above all.
    if (wantsFile(path)) return fileOrNotFound(request, env)

    // 2. A shared thing's link, opened by a crawler or an unfurl bot.
    // A public page, asked for the same way: its own words and canonical.
    const crawled = !isNavigation(request)
    const route = crawled ? previewRouteOf(path) : null
    if (route !== null) return robotsFor(path, await sharedShell(route, url, env, base))
    const page = crawled ? publicPageOf(path) : null
    if (page !== null) return robotsFor(path, await publicShell(page, url, env, base))

    // 3. Everything else: the asset server's answer, `_headers` and all.
    return robotsFor(path, await env.ASSETS.fetch(request))
  },
}

/**
 * The client routes search may index: the app's front door, the public
 * Starter Set, and a sheet its owner chose to make public (ADR-032).
 */
function indexable(path: string): boolean {
  return (
    path === '/' || path === '/starter' || path.startsWith('/starter/') || path.startsWith('/p/')
  )
}

/** A shell answer for a route search should not list, marked `noindex`. */
function robotsFor(path: string, res: Response): Response {
  if (indexable(path)) return res
  const marked = new Response(res.body, res)
  marked.headers.set('x-robots-tag', 'noindex')
  return marked
}

/** Whether a path inside the base names a file: `/assets/*`, or a dot in the last segment. */
function wantsFile(path: string): boolean {
  return path.startsWith('/assets/') || path.slice(path.lastIndexOf('/') + 1).includes('.')
}

/** A browser opening a page: the only request that sends `Sec-Fetch-Mode: navigate`. */
function isNavigation(request: Request): boolean {
  return request.headers.get('sec-fetch-mode') === 'navigate'
}

/**
 * Rule 1. The binding answers a missing file with the shell, `200 text/html`,
 * which becomes a 404. A `304` does not say which body it matched — a client
 * that cached the shell under a chunk's URL revalidates against the shell's
 * ETag — so the binding is asked again without the validators.
 */
async function fileOrNotFound(request: Request, env: Env): Promise<Response> {
  const res = await env.ASSETS.fetch(request)
  if (res.status !== 304) return isShell(res) ? notFound() : res
  return isShell(await env.ASSETS.fetch(withoutValidators(request))) ? notFound() : res
}

function isShell(res: Response): boolean {
  return res.ok && (res.headers.get('content-type') ?? '').startsWith('text/html')
}

function withoutValidators(request: Request): Request {
  const headers = new Headers(request.headers)
  headers.delete('if-none-match')
  headers.delete('if-modified-since')
  return new Request(request.url, { method: request.method, headers })
}

function notFound(): Response {
  return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } })
}

/** Rule 2. The shell, its `itun:meta` block swapped for the route's preview. */
async function sharedShell(
  route: PreviewRoute,
  url: URL,
  env: Env,
  base: string
): Promise<Response> {
  const shell = await shellOf(url, env, base)
  if (!shell.ok) return shell
  const meta = await metaFor(route, url, env, fetch, base)
  if (meta === null) return shell
  return rewritten(shell, (html) => applyMeta(html, meta))
}

/** Rule 2, for a public page: its own words, or the shell's defaults with its canonical. */
async function publicShell(page: PublicPage, url: URL, env: Env, base: string): Promise<Response> {
  const shell = await shellOf(url, env, base)
  if (!shell.ok) return shell
  const words = page.words
  return rewritten(shell, (html) =>
    words === null
      ? applyCanonical(html, publicUrl(url.origin, base, page.path))
      : applyMeta(html, publicMeta({ ...page, words }, url.origin, base))
  )
}

/** The shell, read as the base's directory rather than `index.html`. */
function shellOf(url: URL, env: Env, base: string): Promise<Response> {
  return env.ASSETS.fetch(new Request(new URL(`${base}/`, url), { method: 'GET' }))
}

async function rewritten(shell: Response, rewrite: (html: string) => string): Promise<Response> {
  const headers = new Headers(shell.headers)
  // The body changed length; the runtime recomputes it.
  headers.delete('content-length')
  return new Response(rewrite(await shell.text()), { status: shell.status, headers })
}
