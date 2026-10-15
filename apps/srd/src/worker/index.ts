/**
 * salvageunion.io — the static SRD on Workers Static Assets (ADR-033). Every
 * page is pre-rendered; this script answers only the requests no file matches.
 *
 * ## What reaches this script, and what does not
 *
 * Static Assets answers first, with `public/_headers` applied: a real file is
 * served as itself and never runs this script. `not_found_handling` is `none`,
 * so a miss lands here instead of on the platform's `404-page` handling:
 *
 *   0. `POST /__errors` → a browser error report, logged for Workers Issues
 *      (`observability/cloudflare`'s `handleErrorReport`).
 *   1. `/assets/*` → a bare **404**.
 *   2. a page path from before the move out of `/schema/…/item/` → a **301**
 *      to where it lives now (`../lib/legacyPaths.ts`).
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
 *
 * A 404 is never cached, whatever its path: the next deploy may bring the file.
 * A legacy 301 is, for a day: nothing will be emitted under that grammar again.
 */

import type { RateLimiter } from 'observability/cloudflare'
import { ERROR_REPORT_PATH, handleErrorReport } from 'observability/cloudflare'
import { currentPathFor } from '../lib/legacyPaths'

export type Env = {
  /** Static assets (the built site), with `not_found_handling: none`. */
  ASSETS: { fetch(request: Request): Promise<Response> }
  /** Caps error reports per address (`wrangler.jsonc`); absent in a Preview. */
  ERROR_REPORT_LIMIT?: RateLimiter
}

/** `/404`, not `/404.html`: the asset server's HTML handling redirects the latter. */
const NOT_FOUND_PAGE = '/404'

function notFound(body: BodyInit | null, headers?: HeadersInit): Response {
  const merged = new Headers(headers)
  merged.set('cache-control', 'no-store')
  return new Response(body, { status: 404, headers: merged })
}

/** @public Cloudflare Worker entrypoint — loaded by workerd, not imported. */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // 0. A browser error report.
    if (url.pathname === ERROR_REPORT_PATH) {
      return handleErrorReport(request, { app: 'srd', limiter: env.ERROR_REPORT_LIMIT })
    }

    // 1. A rotated or never-built chunk: nothing a browser could render.
    if (url.pathname.startsWith('/assets/')) {
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
