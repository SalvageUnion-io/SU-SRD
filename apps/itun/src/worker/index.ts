/**
 * intheunionnow.com — the ITUN SPA, on Workers (ADR-033), plus what is left of
 * the retired snapshot shares (ADR-036): one read, and the unfurl text of
 * links already posted.
 *
 * ## The routing table, and why order is load-bearing
 *
 * Every rule has an incident behind it. Cloudflare cannot express
 * method-conditioned routing declaratively, so it is code, and
 * `__tests__/routing.test.ts` asserts each rule and each ordering constraint:
 *
 *   1. a retired URL           → 301 to the page that replaced it (the Share
 *      Snapshot screen, removed in #793, and the per-entity detail pages
 *      collapsed into the live sheet). The table is `./retiredRoutes.ts`.
 *      An installed PWA reaches this too: the service worker sends every
 *      navigation to the network first (`src/lib/sw/workbox.ts`).
 *   2. `/api/snapshots`        → **404**, every method. Publishing is retired
 *      (ADR-036); the endpoint is gone, not merely refusing a method.
 *   3. `/api/snapshots/:id`    → GET answers which entity the snapshot was taken
 *      of, so `/s/:id` can redirect to its live public sheet. Every other method
 *      is 405 — DELETE used to revoke, and nothing writes to the store any more.
 *   4. `/assets/*`             → a miss is **404**, never the SPA shell.
 *   5. a real file             → served as itself.
 *   6. a missing FILE          → **404**. Any path whose last segment contains
 *      a dot wanted a file; a client route in this app never does. This is what
 *      makes `/robots.txt` and `/favicon.ico` behave, and what stops every
 *      typo being an indexable soft-404 — see rule 6's own note below.
 *   7. everything else         → the SPA shell, 200 (with `/s/:id`'s metadata).
 *
 * Every response, whichever rule served it, leaves with the security headers,
 * and every HTML document with `SHELL_CACHE_CONTROL` — see `./securityHeaders.ts`.
 *
 * ## Rule 4 is the one that has already broken production
 *
 * Every hashed chunk a deploy rotates away is requested by exactly one
 * population: clients still running the previous build. Without this rule
 * those requests got `200 text/html`, the import rejected on MIME type,
 * and the `immutable` header pinned that HTML into the HTTP cache **for a year**
 * under the chunk's URL.
 *
 * Cloudflare's `not_found_handling: "single-page-application"` reintroduces
 * exactly that, which is why this Worker sets `"none"` and decides the fallback
 * itself. An honest 404 makes the failed import surface as `vite:preloadError`,
 * which `installChunkRecovery` (`observability/browser`) recovers from with a
 * single reload.
 *
 * ## The unfurl text stays, for links already posted
 *
 * Snapshot links are still in Discord channels, and Discord re-fetches an
 * unfurl. So `/s/:id` keeps its per-snapshot shell metadata — a neutral title
 * naming the entity, read from the stored blob — with no image. Opening the
 * link never shows that build: the client resolves it to the live public sheet
 * or the retired page. The rendered card at `/og/s/:id.png` is gone (ADR-036):
 * that path is a missing file, so rule 6 answers it 404.
 *
 * ## No rate limiter
 *
 * Cloudflare's Rate Limiting binding (`RATE_LIMITER`) covered `POST
 * /api/snapshots` and nothing else, and went with it. Reads were never limited.
 */

import type { ObservabilityEnv } from 'observability/cloudflare'
import { reportError, withObservability } from 'observability/cloudflare'
import { makeIdentityHandler } from '../lib/snapshot/handlers'
import { isValidSnapshotId } from '../lib/snapshot/id'
import type { R2BucketLike } from '../lib/snapshot/storage'
import { createR2Storage } from '../lib/snapshot/storage'
import { retiredRedirect } from './retiredRoutes'
import { withSecurityHeaders } from './securityHeaders'
import type { ShellMeta } from './shellMeta'
import { applyMeta, metaForSnapshot } from './shellMeta'

export type Env = ObservabilityEnv & {
  /** Static assets (the built SPA). `not_found_handling` is "none" — see above. */
  ASSETS: { fetch(request: Request): Promise<Response> }
  /** The retired snapshot store — read, never written (ADR-036). */
  SNAPSHOTS: R2BucketLike
}

const SNAPSHOT_ROUTE = /^\/s\/([^/]+)\/?$/

/**
 * Per-route metadata for the shell, or null to keep the sitewide defaults.
 *
 * Only `/s/:id` today: old snapshot links, already posted in Discord, whose
 * unfurl this keeps (ADR-036). The click itself never shows the stored build —
 * the client resolves it to the live public sheet or the retired page. The data
 * is the one store this Worker holds, the read-only snapshot bucket.
 *
 * `/p/:kind/:appId` is NOT covered, deliberately. Its data lives in Convex
 * behind a `publicRead` column, and ADR-032 makes a private sheet and a
 * nonexistent one **indistinguishable on purpose** — "this exists but is
 * private" is itself a disclosure. Injecting metadata there means reproducing
 * that invariant exactly in a second place; doing it carelessly would leak the
 * existence of every private sheet through its unfurl. It needs its own change,
 * with that as the assertion.
 *
 * Never throws: a failed lookup falls back to the defaults. An unfurl is not
 * worth a 500 on a page that would otherwise render — but the failure is still
 * reported, because an R2 read that fails here fails for `/api/snapshots/:id` too.
 */
async function metaForRoute(request: Request, env: Env): Promise<ShellMeta | null> {
  const url = new URL(request.url)
  const snapshot = SNAPSHOT_ROUTE.exec(url.pathname)
  if (!snapshot) return null

  const id = snapshot[1]
  if (!id || !isValidSnapshotId(id)) return null

  try {
    const stored = await createR2Storage(env.SNAPSHOTS).get(id)
    if (!stored) return null
    return metaForSnapshot(stored, url.toString())
  } catch (error) {
    reportError(error, { source: 'metaForRoute', id })
    return null
  }
}

/** Serve the SPA shell for a client-side route, with this route's metadata. */
async function spaShell(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  url.pathname = '/index.html'
  const shell = await env.ASSETS.fetch(new Request(url.toString(), { method: 'GET' }))

  const meta = await metaForRoute(request, env)
  if (!meta) {
    // Re-wrap so the status is 200 for a client-side route rather than whatever
    // the asset lookup returned, and so this response is not confused with a hit
    // on a real file. (Its Cache-Control is forced on the way out — see
    // `SHELL_CACHE_CONTROL` in `./securityHeaders.ts`.)
    return new Response(shell.body, { status: 200, headers: shell.headers })
  }

  const headers = new Headers(shell.headers)
  // The body length changes with the injected metadata, and a stale
  // Content-Length truncates the document.
  headers.delete('content-length')
  return new Response(applyMeta(await shell.text(), meta), { status: 200, headers })
}

/** @public Cloudflare Worker entrypoint — loaded by workerd, not imported. */
export default withObservability('su-itun', {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Wrapped once, here, rather than at each `return`. There are eight exit
    // paths below and a ninth would otherwise ship bare — which is exactly how
    // the ones that existed came to.
    return withSecurityHeaders(await route(request, env))
  },
})

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname

  // 1. Retired URL. 301 rather than 302: none of these screens is coming back.
  //
  // This reaches installed PWAs too, because the service worker sends every
  // navigation to the network before its precache (`src/lib/sw/workbox.ts`).
  // See `./retiredRoutes.ts`.
  const retired = retiredRedirect(path)
  if (retired) return Response.redirect(`${url.origin}${retired}`, 301)

  // 2. The publish endpoint is gone (ADR-036). A 404 rather than a 405 is also
  //    what makes a still-open tab on an older build degrade honestly: its
  //    feature-detect read 405 as "available", and anything else as "publishing
  //    unavailable", so it stops offering a button that cannot work.
  if (path === '/api/snapshots' || path === '/api/snapshots/') {
    return new Response('Snapshot publishing has been retired', { status: 404 })
  }

  // 3. Which entity a snapshot was taken of. The handler answers 405 for
  //    everything that is not GET, and 400 for a malformed id before it reads.
  if (path.startsWith('/api/snapshots/')) {
    return makeIdentityHandler(createR2Storage(env.SNAPSHOTS))(request)
  }

  const assetResponse = await env.ASSETS.fetch(request)

  // 4. A build asset that does not exist must 404, NOT fall through to the
  //    SPA. See the header comment — this rule has already been a production
  //    incident once (#759).
  if (path.startsWith('/assets/')) {
    return assetResponse
  }

  // 5. A real file wins.
  if (assetResponse.status !== 404) {
    return assetResponse
  }

  // 6. A missing FILE is 404, not the SPA shell.
  //
  //    Rule 7 below is correct for client-side routes and wrong for
  //    everything else: `/robots.txt`, `/sitemap.xml` and `/favicon.ico` all
  //    answered `200 text/html` with the app in the body. A crawler asking
  //    for crawl rules got a web page; so did every typo, which makes the
  //    whole origin an infinite well of soft-404s to index.
  //
  //    A client route in this app never has a file extension — they are
  //    `/pilots/new`, `/sheet/$kind/$id`, `/games/$gameId`. So a dot in the
  //    last segment is a reliable signal that the request wanted a FILE, and
  //    a file that is not there is a 404. This is deliberately narrower than
  //    an allowlist of known filenames, which would go stale silently.
  //
  //    `/assets/*` is already handled above (rule 4) and stays there: it has
  //    its own production-incident history and should not depend on this.
  const lastSegment = path.slice(path.lastIndexOf('/') + 1)
  if (lastSegment.includes('.')) {
    return assetResponse
  }

  // 7. Anything else is a client-side route.
  return spaShell(request, env)
}
