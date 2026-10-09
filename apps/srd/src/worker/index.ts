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
 *   1. `/assets/*` → a bare **404**.
 *   2. anything else → `404.html`, read through the asset binding, with a 404.
 *
 * Both say `cache-control: no-store`.
 *
 * ## Why the script exists at all
 *
 * `_headers` matches on the request path, never on the status, and Static
 * Assets applies it to the `404-page` response as well. So with no script, the
 * `/assets/*` rule stamped `public, max-age=31536000, immutable` on the 404 for
 * a chunk that is not there: a client that asked for a chunk before the deploy
 * bringing it finished kept the 404 for a year. `_headers` is not applied to a
 * response this script builds, so the 404s here carry only what is set below.
 * The page in rule 2 comes back from the binding, which does apply `_headers`
 * (the CSP and the rest of the `/*` block) for its path, `/404`.
 *
 * A miss is never cached, whatever its path: the next deploy may bring the file.
 */

import type { ObservabilityEnv } from 'observability/cloudflare'
import { withObservability } from 'observability/cloudflare'

export type Env = ObservabilityEnv & {
  /** Static assets (the built site), with `not_found_handling: none`. */
  ASSETS: { fetch(request: Request): Promise<Response> }
}

/** `/404`, not `/404.html`: the asset server's HTML handling redirects the latter. */
const NOT_FOUND_PAGE = '/404'

function notFound(body: BodyInit | null, headers?: HeadersInit): Response {
  const merged = new Headers(headers)
  merged.set('cache-control', 'no-store')
  return new Response(body, { status: 404, headers: merged })
}

/** @public Cloudflare Worker entrypoint — loaded by workerd, not imported. */
export default withObservability('su-srd', {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // 1. A rotated or never-built chunk: nothing a browser could render.
    if (url.pathname.startsWith('/assets/')) {
      return notFound('Not found', { 'content-type': 'text/plain;charset=UTF-8' })
    }

    // 2. Every other miss: the site's own 404 page.
    const page = await env.ASSETS.fetch(
      new Request(new URL(NOT_FOUND_PAGE, url), { method: 'GET' })
    )
    if (!page.ok) return notFound('Not found', { 'content-type': 'text/plain;charset=UTF-8' })
    return notFound(page.body, page.headers)
  },
})
