/**
 * The app under `/build`, as the one Worker (`index.ts`) answers it.
 *
 * `wrangler.jsonc`'s `run_worker_first` sends `/build` and everything under it
 * to the Worker before Static Assets looks (`RUN_WORKER_FIRST`, which the
 * routing test holds equal), so no file under the base is served before these
 * rules read it. The binding is the site's own, `not_found_handling: none`;
 * `spaAssets` answers a miss under the base with the shell, as a single-page
 * app's binding would.
 *
 * Under `/build/` the rules read the path inside the base (`basePath.ts`):
 *
 *   D. `/about`, `/changelog` → a 301 to the SRD's page.
 *   R. a retired address (`/games`, `/join/:code`, the old crew view) → a 301
 *      to where it lives now. Both read the moved-path table
 *      (`../lib/redirects.ts`). intheunionnow.com's zone
 *      Redirect Rule sends its old links here.
 *   0. `/og/*.png` → a link preview's picture (`linkPreview.ts`), rendered on
 *      request and cached by version.
 *   1. `/assets/*`, or a dot in the last segment: a FILE, asked of the binding.
 *      A file that is there comes back as itself; one that is not comes back
 *      as the shell, and these rules answer `null`: the site's own miss
 *      (`index.ts`), never the shell.
 *   2. a shared thing's route (`/p/:kind/:appId`, `/invite/:token`) asked for
 *      without `Sec-Fetch-Mode: navigate` (a crawler, an unfurl bot) → the
 *      shell with its `app:meta` block swapped for that thing's preview
 *      (`shellMeta.ts`). The front door asked for the same way gets the shell
 *      with its canonical.
 *   3. anything else → the binding's answer: the shell for a navigation to
 *      any client route, its Union bar marked for the route's mode and nav
 *      item (`markUnionRoute`), and hidden on the routes that draw none. The Starter Set, each of its builds and `/sitemap.xml` are files
 *      the build pre-renders (`publicPages.ts`).
 *
 * Rules 2 and 3 answer with the shell, and every client route but the public
 * ones (`indexable`) carries `X-Robots-Tag: noindex`: a game, a pilot's sheet
 * or a sign-in screen is a private or empty page to a crawler.
 *
 * ## Rule 1 is the one that has already broken production
 *
 * Every hashed chunk a deploy rotates away is requested by exactly one
 * population: clients still running the previous build, by module import,
 * never by navigation. When those requests got `200 text/html`, the import
 * rejected on MIME type and the `immutable` header pinned that HTML into the
 * HTTP cache **for a year** under the chunk's URL. An honest 404 makes the
 * failed import surface as `vite:preloadError`, which `installChunkRecovery`
 * (`lib/browserObservability.ts`) recovers from with a single reload. A client route
 * never has a file extension, so a dot in the last segment means a FILE.
 */

import { APP_BASE, routeInApp } from '../lib/appBase'
import { retiredDocPage, retiredTarget } from '../lib/redirects'
import { hidesUnionBar } from '../shell/unionSlots'
import { pathInApp } from './basePath'
import type { ImageCache, PreviewEnv, PreviewRoute } from './linkPreview'
import { isOgImagePath, metaFor, ogImage, previewRouteOf } from './linkPreview'
import { frontDoorShell } from './publicPages'
import { applyMeta, hideUnionBar, markUnionRoute } from './shellMeta'

/**
 * `wrangler.jsonc`'s `run_worker_first`. A positive list only: a negative
 * pattern sends its matches straight to the assets, and `true` would run the
 * script for every SRD page.
 */
export const RUN_WORKER_FIRST = [APP_BASE, `${APP_BASE}/*`]

type Assets = { fetch(request: Request): Promise<Response> }

export type AppEnv = PreviewEnv & {
  /** The site's static assets, `not_found_handling: none`. */
  ASSETS: Assets
}

/** Whether a path is the app's: `/build` itself or anything under it. */
export function isBuildPath(pathname: string): boolean {
  return routeInApp(pathname) !== null
}

/**
 * A binding that answers a miss under the base with the shell, as Static
 * Assets' `single-page-application` mode does. Anything else passes through.
 */
export function spaAssets(assets: Assets, base: string): Assets {
  return {
    async fetch(request: Request): Promise<Response> {
      const res = await assets.fetch(request)
      if (res.status !== 404 || !new URL(request.url).pathname.startsWith(`${base}/`)) return res
      const shell = new Request(new URL(`${base}/`, request.url), {
        method: request.method,
        headers: request.headers,
      })
      return assets.fetch(shell)
    },
  }
}

/** The Cache API's default cache, where the runtime has one (never under Bun). */
function defaultCache(): ImageCache | undefined {
  return (globalThis as { caches?: { default?: ImageCache } }).caches?.default
}

/**
 * A request under the base (`isBuildPath`); `null` for a missing file, which
 * the site answers as any other miss.
 */
export async function serveApp(
  request: Request,
  siteEnv: AppEnv,
  base = APP_BASE
): Promise<Response | null> {
  const url = new URL(request.url)
  // The bare base: its directory, query kept.
  if (url.pathname === base) {
    return new Response(null, { status: 301, headers: { location: `${base}/${url.search}` } })
  }
  const env = { ...siteEnv, ASSETS: spaAssets(siteEnv.ASSETS, base) }

  // Every rule below reads the path inside the app; a URL it builds puts the
  // base back.
  const path = pathInApp(url.pathname, base)

  // D. A doc page the app no longer has: the SRD's on this origin.
  const docPage = retiredDocPage(path)
  if (docPage !== null) return Response.redirect(new URL(docPage, url).href, 301)

  // R. A retired address: one hop to where it lives now, query kept.
  const retired = retiredTarget(path)
  if (retired !== null) {
    return new Response(null, {
      status: 301,
      headers: { location: `${base}${retired}${url.search}` },
    })
  }

  // 0. A link preview's picture — a file that exists only on request.
  if (isOgImagePath(path)) return ogImage(request, env, { cache: defaultCache(), base })

  // 1. A FILE: itself, or the site's miss — never the shell.
  if (wantsFile(path)) return fileOrMiss(request, env)

  // 2. A shared thing's link, opened by a crawler or an unfurl bot.
  const crawled = !isNavigation(request)
  const route = crawled ? previewRouteOf(path) : null
  if (route !== null) return robotsFor(path, await sharedShell(route, url, env, base))
  // The front door, asked for the same way: the shell with its canonical.
  if (crawled && path === '/') return robotsFor(path, await frontDoor(url, env, base))

  // 3. Everything else: the asset server's answer, `_headers` and all. The
  // shell's Union bar is marked for the route, so its mode, tab and nav item
  // are right from the start, and a route that draws no bar gets a shell that
  // hides it from the start.
  const res = await env.ASSETS.fetch(request)
  if (!isShell(res)) return robotsFor(path, res)
  const bare = hidesUnionBar(path)
  return robotsFor(
    path,
    await rewritten(res, (shell) => {
      const marked = markUnionRoute(shell, path)
      return bare ? hideUnionBar(marked) : marked
    })
  )
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
  return indexable(path) ? res : noindexed(res)
}

function noindexed(res: Response): Response {
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
 * which becomes the site's miss. A `304` does not say which body it matched — a client
 * that cached the shell under a chunk's URL revalidates against the shell's
 * ETag — so the binding is asked again without the validators.
 */
async function fileOrMiss(request: Request, env: AppEnv): Promise<Response | null> {
  const res = await env.ASSETS.fetch(request)
  if (res.status !== 304) return isShell(res) ? null : res
  return isShell(await env.ASSETS.fetch(withoutValidators(request))) ? null : res
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

/** Rule 2. The shell, its `app:meta` block swapped for the route's preview. */
async function sharedShell(
  route: PreviewRoute,
  url: URL,
  env: AppEnv,
  base: string
): Promise<Response> {
  const shell = await shellOf(url, env, base)
  if (!shell.ok) return shell
  const meta = await metaFor(route, url, env, fetch, base)
  const res = meta === null ? shell : await rewritten(shell, (html) => applyMeta(html, meta))
  // A missing or private sheet answers like a page: search must not list it.
  return meta?.canonical === undefined ? noindexed(res) : res
}

/**
 * Rule 2, for the front door: the shell with its canonical. The other public
 * pages are pre-rendered (`publicPages.ts`).
 */
async function frontDoor(url: URL, env: AppEnv, base: string): Promise<Response> {
  const shell = await shellOf(url, env, base)
  if (!shell.ok) return shell
  return rewritten(shell, (html) => frontDoorShell(html, url.origin, base))
}

/** The shell, read as the base's directory rather than `index.html`. */
function shellOf(url: URL, env: AppEnv, base: string): Promise<Response> {
  return env.ASSETS.fetch(new Request(new URL(`${base}/`, url), { method: 'GET' }))
}

async function rewritten(shell: Response, rewrite: (html: string) => string): Promise<Response> {
  const headers = new Headers(shell.headers)
  // The body changed length; the runtime recomputes it.
  headers.delete('content-length')
  return new Response(rewrite(await shell.text()), { status: shell.status, headers })
}
