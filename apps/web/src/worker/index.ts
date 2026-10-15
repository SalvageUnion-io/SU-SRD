/**
 * salvageunion.io on Workers Static Assets (ADR-033): the one Worker for the
 * whole app. Every reference page is pre-rendered, so this script answers only
 * the requests no file matches, and everything under `/build`, the Cantina's
 * (`./builder.ts`).
 *
 * ## What reaches this script, and what does not
 *
 * Static Assets answers first, with `public/_headers` applied: a real file is
 * served as itself and never runs this script. `not_found_handling` is `none`,
 * so a miss lands here instead of on the platform's `404-page` handling.
 * `run_worker_first` sends `/build` and below here before Static Assets looks.
 *
 *   E. `POST /__errors` → a browser error report, and `POST /__convex-logs` →
 *      Convex's log stream, both logged for Workers Issues
 *      (`errorReports.ts`).
 *   B. `/build` and below → the Cantina (`./builder.ts`); a file it does not
 *      have falls through to the rules below.
 *   1. `/assets/*` (or `/build/assets/*`) → a bare **404**.
 *   2. a page path from before the move out of `/schema/…/item/` → a **301**
 *      to where it lives now (`../lib/redirects.ts`).
 *   3. anything else → `404.html`, read through the asset binding, with a 404.
 *
 * The 404s say `cache-control: no-store`; the 301 is permanent and cacheable.
 *
 * ## Why the script exists at all
 *
 * `_headers` matches on the request path, never on the status, and Static
 * Assets applies it to the `404-page` response as well. So with no script, the
 * `/assets/*` rule stamped `public, max-age=31536000, immutable` on the 404 for
 * a chunk that is not there: a client that asked for a chunk before the deploy
 * bringing it finished kept the 404 for a year. `_headers` is not applied to a
 * response this script builds, so the 404s here carry only what is set below.
 * The page in rule 3 comes back from the binding, which does apply `_headers`
 * (the CSP and the rest of the `/*` block) for its path, `/404`.
 */

import { currentPathFor } from '../lib/redirects'
import { appPath } from '../lib/site'
import type { BuilderEnv } from './builder'
import { isBuildPath, serveBuilder } from './builder'
import type { RateLimiter } from './errorReports'
import {
  CONVEX_LOG_STREAM_PATH,
  ERROR_REPORT_PATH,
  handleConvexLogStream,
  handleErrorReport,
} from './errorReports'

export type Env = BuilderEnv & {
  /** Caps error reports per address (`wrangler.jsonc`); absent in a Preview. */
  ERROR_REPORT_LIMIT?: RateLimiter
  /**
   * The Convex log stream's webhook secret, from the Convex dashboard. Set
   * with `wrangler secret put`; unset, the stream endpoint answers 503.
   */
  CONVEX_LOG_STREAM_SECRET?: string
}

/**
 * Where the Convex log stream posted before the app was one: the webhook the
 * Convex dashboard still names until it is pointed at `CONVEX_LOG_STREAM_PATH`.
 */
const RETIRED_CONVEX_LOG_STREAM_PATH = appPath(CONVEX_LOG_STREAM_PATH)

/** `/404`, not `/404.html`: the asset server's HTML handling redirects the latter. */
const NOT_FOUND_PAGE = '/404'

function notFound(body: BodyInit | null, headers?: HeadersInit): Response {
  const merged = new Headers(headers)
  merged.set('cache-control', 'no-store')
  return new Response(body, { status: 404, headers: merged })
}

/** A rotated or never-built chunk: nothing a browser could render. */
function isChunk(pathname: string): boolean {
  return pathname.startsWith('/assets/') || pathname.startsWith(appPath('/assets/'))
}

/** @public Cloudflare Worker entrypoint — loaded by workerd, not imported. */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // E. Errors from elsewhere: the browser's, and Convex's log stream.
    if (url.pathname === ERROR_REPORT_PATH) {
      return handleErrorReport(request, { app: 'web', limiter: env.ERROR_REPORT_LIMIT })
    }
    if (
      url.pathname === CONVEX_LOG_STREAM_PATH ||
      url.pathname === RETIRED_CONVEX_LOG_STREAM_PATH
    ) {
      return handleConvexLogStream(request, env.CONVEX_LOG_STREAM_SECRET)
    }

    // B. The Cantina, under its base.
    if (isBuildPath(url.pathname)) {
      const res = await serveBuilder(request, env)
      if (res !== null) return res
    }

    // 1. A rotated or never-built chunk.
    if (isChunk(url.pathname)) {
      return notFound('Not found', { 'content-type': 'text/plain;charset=UTF-8' })
    }

    // 2. A page under the old grammar: one hop to its new address, query kept.
    const moved = currentPathFor(url.pathname)
    if (moved) {
      return new Response(null, {
        status: 301,
        headers: {
          location: `${moved}${url.search}`,
          'cache-control': 'public, max-age=86400',
        },
      })
    }

    // 3. Every other miss: the site's own 404 page.
    const page = await env.ASSETS.fetch(
      new Request(new URL(NOT_FOUND_PAGE, url), { method: 'GET' })
    )
    if (!page.ok) return notFound('Not found', { 'content-type': 'text/plain;charset=UTF-8' })
    return notFound(page.body, page.headers)
  },
}
