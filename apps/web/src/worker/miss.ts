/**
 * A request no file and no other route answers (`astro/worker/miss.ts`), and
 * what a route answers when it has nothing at a path under it.
 *
 *   - `api-root`: `/api/v1` or `/api/v1/` itself → a **301** to the tree's
 *     manifest, `/api/v1/index.json`: still JSON for a client, and the list of
 *     every file for a person.
 *   - `api-miss`: anything else under `/api/v1` → a JSON **404** naming the
 *     manifest, so a client reading the Dataset API never parses the HTML page
 *     (ADR-056).
 *   - `chunk-miss`: `/assets/*` (or `/build/assets/*`) → a bare **404**.
 *   - `legacy-301`: a page path from before the move out of `/schema/…/item/`,
 *     or one that is gone (the search page, an action's page, a touch icon by
 *     its conventional name) → a **301** to where it lives now
 *     (`../lib/redirects.ts`).
 *   - `not-found`: anything else → `404.html`, read through the asset
 *     binding, with a 404.
 *
 * The 404s say `cache-control: no-store`; the 301 is permanent and cacheable.
 *
 * ## Why a miss is the Worker's at all
 *
 * `_headers` matches on the request path, never on the status, and Static
 * Assets applies it to the `404-page` response as well. So with no script, the
 * `/assets/*` rule stamped `public, max-age=31536000, immutable` on the 404 for
 * a chunk that is not there: a client that asked for a chunk before the deploy
 * bringing it finished kept the 404 for a year. `_headers` is not applied to a
 * response the Worker builds, so the 404s here carry only what is set below.
 * The `not-found` page comes back from the binding, which does apply `_headers`
 * (the CSP and the rest of the `/*` block) for its path, `/404`.
 */

import { API_V1_PATH } from '../lib/apiV1Paths'
import { appPath } from '../lib/appBase'
import { currentPathFor, formerSitePath, retiredSitePage } from '../lib/redirects'

type Assets = { fetch(request: Request): Promise<Response> }

/** `/404`, not `/404.html`: the asset server's HTML handling redirects the latter. */
const NOT_FOUND_PAGE = '/404'

function notFound(body: BodyInit | null, headers?: HeadersInit): Response {
  const merged = new Headers(headers)
  merged.set('cache-control', 'no-store')
  return new Response(body, { status: 404, headers: merged })
}

/** The Dataset API's tree; every file in it is a real file, so a miss is a 404. */
function isApiPath(pathname: string): boolean {
  return pathname === API_V1_PATH || pathname.startsWith(`${API_V1_PATH}/`)
}

/** A miss under the API, as JSON a client can read, on the API's CORS terms. */
function apiNotFound(url: URL): Response {
  const body = JSON.stringify({
    error: 'not_found',
    path: url.pathname,
    index: `${url.origin}${API_V1_PATH}/index.json`,
    docs: `${url.origin}/api/`,
  })
  return notFound(body, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
  })
}

/** A rotated or never-built chunk: nothing a browser could render. */
function isChunk(pathname: string): boolean {
  return pathname.startsWith('/assets/') || pathname.startsWith(appPath('/assets/'))
}

export async function serveMiss(request: Request, env: { ASSETS: Assets }): Promise<Response> {
  const url = new URL(request.url)

  // 1. The Dataset API's root, a directory with no file: its manifest.
  // Anything else under it with no file is a JSON miss.
  if (url.pathname.replace(/\/+$/, '') === API_V1_PATH) {
    return Response.redirect(new URL(`${API_V1_PATH}/index.json${url.search}`, url).href, 301)
  }
  if (isApiPath(url.pathname)) return apiNotFound(url)

  // 2. A rotated or never-built chunk.
  if (isChunk(url.pathname)) {
    return notFound('Not found', { 'content-type': 'text/plain;charset=UTF-8' })
  }

  // 3. A page under the old grammar, or one that is gone (the search page,
  // an action's page): one hop to its new address, query kept.
  const moved =
    currentPathFor(url.pathname) ?? retiredSitePage(url.pathname) ?? formerSitePath(url.pathname)
  if (moved) {
    const query = moved.includes('?') ? url.search.replace(/^\?/, '&') : url.search
    return new Response(null, {
      status: 301,
      headers: {
        location: `${moved}${query}`,
        'cache-control': 'public, max-age=86400',
      },
    })
  }

  // 4. Every other miss: the site's own 404 page.
  const page = await env.ASSETS.fetch(new Request(new URL(NOT_FOUND_PAGE, url), { method: 'GET' }))
  if (!page.ok) return notFound('Not found', { 'content-type': 'text/plain;charset=UTF-8' })
  return notFound(page.body, page.headers)
}
