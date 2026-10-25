/**
 * dev — the development server: the reference site's pages, and the app at `/build`.
 *
 * ## The one rule
 *
 * Dev renders through the SAME code path as prod. A request is resolved to a
 * route from `ssg/routes.ts`, rendered by the very `render`/`renderDocument`
 * pair `ssg/build.ts` calls, and only then handed to Vite for
 * `transformIndexHtml`. There is no client-rendered SPA fallback and no
 * dev-only page shell, because a divergent dev path is how production-only
 * bugs get written (see `ssg/DESIGN.md`).
 *
 * The cost of that honesty is latency: every request renders a page server-side
 * for real. That is the trade the design makes deliberately.
 *
 * ## Why `ssrLoadModule` and not a plain `import`
 *
 * `ssg/build.ts` loads the route registry with a dynamic `import()` under Bun,
 * behind a `Bun.plugin` that stubs `.css` (the SSR pass there never touches
 * Vite, so a stylesheet import would be loaded by whatever the runtime happens
 * to do with it). Here the opposite is true: everything under `src/` and both
 * linked workspace packages go through Vite's SSR pipeline, which already knows
 * what a `.css` import means — so no stub is needed, and the whole module graph
 * is invalidated on edit. That is why a page edit shows up on the next request
 * with no restart, and why `dev.ts` must never import the page modules directly.
 * The only static imports here are `import type`.
 *
 * ## Assets
 *
 * Prod reads hashed URLs out of `dist/.vite/manifest.json`. Dev has no manifest,
 * so it fills the same `BuildAssets` shape with the source paths Vite already
 * serves. `styles.entry.ts` is linked as a *script* rather than a stylesheet —
 * in dev Vite injects css from JS, which is what buys css HMR.
 *
 * ## Parity with prod
 *
 * Every document this serves should match the file `ssg/build.ts` emits for
 * the same route, apart from three dev-only things: `@vite/client`, the
 * react-refresh preamble, and the asset urls.
 */

import { readdirSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createServer as createHttpServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { CHECKOUT_HEADER, CHECKOUT_ROOT, portFor } from 'gates/ports'
import type { ViteDevServer } from 'vite'
import { createServer as createViteServer } from 'vite'
import { HOMEBREW_PATTERNS_PATH } from '../src/lib/homebrew/endpoint'
import { DEV_BASE_STYLESHEET } from '../src/styles/baseStylesheet'
import type { BuildAssets } from './document'
import type { EndpointRegistration, ResolvedEndpoint } from './endpoints'
import type { ErasedRoute, RouteRegistration } from './render'

/**
 * Repo convention: the dev server lives on this checkout's port (4321 in the
 * primary checkout, offset in a worktree: `packages/gates/lib/ports.ts`) and is
 * restarted in place. An explicit `PORT` wins.
 */
const PORT = Number(process.env.PORT ?? portFor())

// Absolute addresses follow the env they are served from
// (`src/lib/constants.ts`): the dev server names itself, for both apps, since
// it serves both. Set before Vite starts, which reads it into
// `import.meta.env`; a value given wins.
process.env.VITE_SITE_ORIGIN ||= `http://localhost:${PORT}`

const viteConfigFile = fileURLToPath(new URL('../vite.config.ts', import.meta.url))

const ASSETS_DIR = fileURLToPath(new URL('../src/assets/', import.meta.url))

/**
 * The dev equivalent of the built manifest. Both entries are served by Vite from
 * source; neither is hashed, and there is no font preload. The one stylesheet
 * link is the base (`src/styles/baseStylesheet.ts`), served as CSS from source; the reference site's own
 * css Vite injects from the styles entry itself.
 *
 * `built` is read off the filesystem rather than listed, so an asset added to
 * `src/assets/` (and to `src/runtime/assets.entry.ts`) needs no edit here. In
 * dev there is nothing to hash: Vite serves a source file at its own path, so
 * the manifest key and the url differ only by the leading slash.
 */
const DEV_ASSETS: BuildAssets = {
  scripts: ['/src/runtime/styles.entry.ts', '/src/runtime/islands.client.ts'],
  styles: [DEV_BASE_STYLESHEET],
  fonts: [],
  built: Object.fromEntries(
    readdirSync(ASSETS_DIR).map((name) => [`src/assets/${name}`, `/src/assets/${name}`])
  ),
}

const HTML_CONTENT_TYPE = 'text/html; charset=utf-8'

type RoutesModule = { routes: RouteRegistration[] }
type EndpointsModule = { endpoints: EndpointRegistration[] }

/** What the handler decided to send. */
type DevResponse = { status: number; contentType: string; body: string }

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * `'/[schemaId]/[itemId]'` -> `/^\/([^/]+)\/([^/]+)$/`.
 *
 * Used only to decide *which* registration can possibly serve a path, so the
 * request pays for one module's `getStaticPaths()` instead of all fourteen.
 * The concrete path still has to exist in that module's resolved set.
 */
function patternToRegExp(pattern: string): RegExp {
  const source = pattern
    .split(/(\[[^\]]+\])/)
    .map((part) => (part.startsWith('[') && part.endsWith(']') ? '([^/]+)' : escapeRegExp(part)))
    .join('')
  return new RegExp(`^${source}$`)
}

/**
 * Resolved routes, memoized per registration *object*.
 *
 * `ssrLoadModule` hands back a freshly evaluated namespace after an edit, so
 * the registrations inside it are new objects and the stale entries here simply
 * become unreachable — the cache invalidates itself, with no file watching of
 * our own.
 */
const routeCache = new WeakMap<RouteRegistration, Map<string, ErasedRoute>>()
const endpointCache = new WeakMap<EndpointRegistration, Map<string, ResolvedEndpoint>>()

function routesFor(registration: RouteRegistration): Map<string, ErasedRoute> {
  const cached = routeCache.get(registration)
  if (cached) return cached
  const resolved = new Map(registration.resolve().map((route) => [route.route, route]))
  routeCache.set(registration, resolved)
  return resolved
}

function endpointsFor(registration: EndpointRegistration): Map<string, ResolvedEndpoint> {
  const cached = endpointCache.get(registration)
  if (cached) return cached
  const resolved = new Map(registration.resolve().map((entry) => [entry.outputPath, entry]))
  endpointCache.set(registration, resolved)
  return resolved
}

/**
 * Request pathname -> route key. Route keys carry no trailing slash (`/` stays
 * `/`), matching what `resolveRoutes` produces, so `/about` and `/about/` are
 * the same page — as they are in prod, where both are served by
 * `about/index.html`.
 */
function normalizeRoute(pathname: string): string {
  if (pathname === '/') return '/'
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

async function loadRoutes(vite: ViteDevServer): Promise<RouteRegistration[]> {
  const module = (await vite.ssrLoadModule('/ssg/routes.ts')) as unknown as RoutesModule
  return module.routes
}

async function loadEndpoints(vite: ViteDevServer): Promise<EndpointRegistration[]> {
  const module = (await vite.ssrLoadModule('/ssg/endpoints.ts')) as unknown as EndpointsModule
  return module.endpoints
}

/**
 * The dotted routes (`/schema/chassis.json`, `/llms.txt`, `/search-index.json`).
 *
 * Checked BEFORE pages, and that order is load-bearing: `/schema/chassis.json`
 * also matches the page pattern `/[schemaId]/[itemId]`, because a pattern segment
 * happily swallows a dot. An endpoint pattern is a dist-relative path, so the
 * leading slash comes off before matching.
 */
function matchEndpoint(
  registrations: EndpointRegistration[],
  pathname: string
): DevResponse | undefined {
  const outputPath = pathname.replace(/^\/+/, '')
  for (const registration of registrations) {
    if (!patternToRegExp(registration.pattern).test(outputPath)) continue
    const entry = endpointsFor(registration).get(outputPath)
    if (entry) return { status: 200, contentType: entry.contentType, body: entry.body() }
  }
  return undefined
}

function matchRoute(registrations: RouteRegistration[], route: string): ErasedRoute | undefined {
  for (const registration of registrations) {
    if (!patternToRegExp(registration.pattern).test(route)) continue
    const found = routesFor(registration).get(route)
    if (found) return found
  }
  return undefined
}

/**
 * `/404` is a real route in the registry, so the not-found page is rendered by
 * the same machinery as every other page — never a hand-written string.
 */
function renderNotFound(registrations: RouteRegistration[]): DevResponse {
  const notFound = matchRoute(registrations, '/404')
  if (!notFound) throw new Error('no /404 route is registered')
  return { status: 404, contentType: HTML_CONTENT_TYPE, body: notFound.render(DEV_ASSETS) }
}

async function handleRequest(vite: ViteDevServer, pathname: string): Promise<DevResponse> {
  const endpoints = await loadEndpoints(vite)
  const endpointResponse = matchEndpoint(endpoints, pathname)
  if (endpointResponse) return endpointResponse

  const routes = await loadRoutes(vite)
  const route = matchRoute(routes, normalizeRoute(pathname))
  const response = route
    ? { status: 200, contentType: HTML_CONTENT_TYPE, body: route.render(DEV_ASSETS) }
    : renderNotFound(routes)

  // Vite's own html transforms: @vite/client, the react-refresh preamble, and
  // any plugin transform. Prod injects nothing here, which is the entire
  // difference between the two documents.
  return { ...response, body: await vite.transformIndexHtml(pathname, response.body) }
}

function errorPage(error: unknown): DevResponse {
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error)
  const escaped = detail.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return {
    status: 500,
    contentType: HTML_CONTENT_TYPE,
    body: `<!doctype html><html lang="en"><head><title>500</title></head><body><h1>500 — render failed</h1><pre>${escaped}</pre></body></html>`,
  }
}

function send(req: IncomingMessage, res: ServerResponse, response: DevResponse): void {
  res.statusCode = response.status
  res.setHeader('Content-Type', response.contentType)
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  res.end(response.body)
}

async function serve(vite: ViteDevServer, req: IncomingMessage, res: ServerResponse) {
  const started = Date.now()
  const url = new URL(req.url ?? '/', 'http://localhost')

  // `decodeURIComponent` throws URIError on a malformed escape — a bare `/%`,
  // or `/%zz` — so it stays inside a try: a nonsense URL must 404 or 500, not
  // escape the handler.
  let pathname = url.pathname
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    // Undecodable: serve the raw path so route matching simply misses and the
    // request 404s like any other unknown URL.
  }

  // Homebrew is the Worker's in production (`src/worker/homebrew.ts`); here
  // the same handler reads the local Convex the app talks to.
  if (pathname === HOMEBREW_PATTERNS_PATH) {
    const { serveHomebrew } = await import('../src/worker/homebrew')
    const answer = await serveHomebrew(url, { CONVEX_URL: process.env.VITE_CONVEX_URL })
    res.statusCode = answer.status
    res.setHeader('Content-Type', answer.headers.get('content-type') ?? 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.end(await answer.text())
    return
  }

  try {
    const response = await handleRequest(vite, pathname)
    send(req, res, response)
    // biome-ignore lint/suspicious/noConsole: build-time CLI — progress output is the interface
    console.log(`[dev] ${response.status} ${pathname} (${Date.now() - started}ms)`)
  } catch (error) {
    if (error instanceof Error) vite.ssrFixStacktrace(error)
    console.error(`[dev] 500 ${pathname}`, error)
    send(req, res, errorPage(error))
  }
}

async function main(): Promise<void> {
  // Created first so Vite attaches its HMR socket to it.
  const server = createHttpServer()
  // The same config `vite build` reads (ADR-050). Its shell plugin answers the
  // app's navigations (`/build/**`, `/play/**`) with the shell, as production does;
  // every other document comes from the route registry below.
  const vite = await createViteServer({
    configFile: viteConfigFile,
    // The shell renders the Union bar from the UI library's source, which only
    // Vite's module runner resolves (the bundling loader leaves it to Node).
    configLoader: 'runner',
    // 'custom' stops Vite from serving an index.html fallback: the reference site has no
    // index.html at all, every document comes from the route registry.
    appType: 'custom',
    server: { middlewareMode: true, hmr: { server } },
  })

  // Vite's own middlewares get every request first (public/, /src/**, /@vite/**,
  // /@fs/**, the app's shell); whatever they leave unclaimed falls through
  // to the renderer.
  //
  // The renderer is deliberately NOT pushed onto `vite.middlewares` with
  // `.use()`. Vite restarts itself whenever `vite.config.ts` changes, and its
  // restart path does `middlewares.stack = newServer.middlewares.stack` — it
  // keeps the connect *instance* but replaces its stack wholesale, so anything
  // appended to it is silently dropped and every page 404s with connect's
  // "Cannot GET /…" until the process is restarted. Handling the fall-through
  // out here, and reading `vite.middlewares` per request, survives that.
  server.on('request', (req: IncomingMessage, res: ServerResponse) => {
    // Names this checkout, so `bun run shot` can refuse another checkout's server.
    res.setHeader(CHECKOUT_HEADER, CHECKOUT_ROOT)
    vite.middlewares(req, res, () => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.statusCode = 405
        res.setHeader('Allow', 'GET, HEAD')
        res.end()
        return
      }
      void serve(vite, req, res)
    })
  })

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      // The repo convention is one dev server per checkout, restarted in place
      // on its own port — so this is a stop-and-fix, never a silent hop to the
      // next free port.
      console.error(`[dev] port ${PORT} is already in use — stop the other dev server first`)
      process.exit(1)
    }
    throw error
  })

  server.listen(PORT, () => {
    // biome-ignore lint/suspicious/noConsole: build-time CLI — progress output is the interface
    console.log(`[dev] srd on http://localhost:${PORT}, the app on /build/`)
  })

  const shutdown = () => {
    server.close()
    void vite.close().then(() => process.exit(0))
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

await main()
