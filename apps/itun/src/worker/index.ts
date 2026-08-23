/**
 * intheunionnow.com — the ITUN SPA plus its snapshot API, on Workers
 * (ADR-033).
 *
 * ## The routing table, and why order is load-bearing
 *
 * `netlify.toml` expressed this as an ordered redirect list, and every entry in
 * it has an incident behind it. Cloudflare cannot express method-conditioned
 * routing declaratively, so it becomes code — which is an improvement in
 * legibility and a risk in fidelity. The order below is the same order, and the
 * reasons are kept with it:
 *
 *   1. `/sheet/:kind/:id/share` → 301 to the sheet. The Share Snapshot screen
 *      was removed in #793; this is where a bookmark or a pasted builder link
 *      would otherwise dead-end on the SPA's not-found page.
 *   2. `/api/snapshots`        → POST publishes; every other method 405.
 *   3. `/api/snapshots/:id`    → DELETE revokes, GET retrieves. DELETE must be
 *      matched BEFORE GET, or an unconditioned retrieve swallows it into a 405.
 *   4. `/assets/*`             → a miss is **404**, never the SPA shell.
 *   5. a real file             → served as itself.
 *   6. a missing FILE          → **404**. Any path whose last segment contains
 *      a dot wanted a file; a client route in this app never does. This is what
 *      makes `/robots.txt` and `/favicon.ico` behave, and what stops every
 *      typo being an indexable soft-404 — see rule 6's own note below.
 *   7. everything else         → the SPA shell, 200.
 *
 * ## Rule 4 is the one that has already broken production
 *
 * Every hashed chunk a deploy rotates away is requested by exactly one
 * population: clients still running the previous build. Before the Netlify rule
 * existed those requests got `200 text/html`, the import rejected on MIME type,
 * and the `immutable` header pinned that HTML into the HTTP cache **for a year**
 * under the chunk's URL.
 *
 * Cloudflare's `not_found_handling: "single-page-application"` reintroduces
 * exactly that, which is why this Worker sets `"none"` and decides the fallback
 * itself. An honest 404 makes the failed import surface as `vite:preloadError`,
 * which `src/lib/chunkRecovery.ts` recovers from with a single reload.
 *
 * ## Rate limiting
 *
 * The Netlify handler carried a module-scope `RateLimiter{10/min}` keyed on
 * `x-nf-client-connection-ip`. It is **deliberately not ported** (P3 decision):
 * it was already approximate across Function instances, would be equally so
 * across isolates, and sits behind an enforced 256 KB payload cap that does the
 * actual storage-amplification work. Porting it would produce something that
 * looks like a control without being one.
 *
 * `RATE_LIMITER` is Cloudflare's own binding, which is a real control because it
 * is enforced at the edge rather than per-instance. It is optional here so the
 * Worker still runs without it — absent binding means no limiting, which is the
 * same protection the 256 KB cap already provides, rather than a crash.
 */

import {
  makeDeleteHandler,
  makePublishHandler,
  makeRetrieveHandler,
} from '../lib/snapshot/handlers'
import { isValidSnapshotId } from '../lib/snapshot/id'
import { validateSnapshotPayload } from '../lib/snapshot/payload'
import { setSnapshotReporter } from '../lib/snapshot/report'
import type { R2BucketLike } from '../lib/snapshot/storage'
import { createR2Storage } from '../lib/snapshot/storage'
import type { ShellMeta } from './shellMeta'
import { applyMeta, metaForSnapshot } from './shellMeta'

/**
 * The Worker opts OUT of the handlers' in-process rate limiter.
 *
 * It counts per isolate, which makes it approximate to the point of being
 * decorative, and Cloudflare's Rate Limiting binding is enforced at the edge —
 * a real control. Running both would be two mechanisms where one is meaningful
 * (ADR-033 P3). The enforced 256 KB payload cap is what actually bounds storage
 * amplification, and it applies either way.
 */
const NO_IN_PROCESS_LIMIT = { rateLimiter: null } as const

/**
 * Publish options for this host: no in-process limiter, and the STRICT payload
 * check.
 *
 * This Worker is the only place a snapshot can actually be published —
 * Netlify's publish is frozen and answers 503 before it reads a body — so this
 * is where "a snapshot that cannot be rendered cannot be published" is
 * enforced. `validateSnapshotPayload` runs the same Zod parse `/s/$id` runs on
 * the way out, so the two cannot drift.
 *
 * It is injected rather than imported inside `handlers.ts` because that module
 * is shared with the Netlify functions, whose bundler cannot resolve `zod` —
 * see the note on `isJsonObject` there. wrangler bundles it inline without
 * complaint; the cost is measured in `payload.ts`.
 */
const PUBLISH_OPTIONS = {
  rateLimiter: null,
  validatePayload: validateSnapshotPayload,
} as const

/** Cloudflare's Rate Limiting binding, as much of it as this Worker uses. */
type RateLimiterBinding = {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

export type Env = {
  /** Static assets (the built SPA). `not_found_handling` is "none" — see above. */
  ASSETS: { fetch(request: Request): Promise<Response> }
  SNAPSHOTS: R2BucketLike
  /** Optional. Absent means no rate limiting, not a crash. */
  RATE_LIMITER?: RateLimiterBinding
}

/**
 * The caller's IP, as Cloudflare presents it.
 *
 * `CF-Connecting-IP` is set by the edge and cannot be spoofed by the client,
 * unlike `x-forwarded-for`, which anyone may send. The Netlify equivalent was
 * `x-nf-client-connection-ip`.
 */
function clientIp(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? 'unknown'
}

const SHARE_PATH = /^\/sheet\/([^/]+)\/([^/]+)\/share\/?$/

const SNAPSHOT_ROUTE = /^\/s\/([^/]+)\/?$/

/**
 * Per-route metadata for the shell, or null to keep the sitewide defaults.
 *
 * Only `/s/:id` today. That is the route salvageunion.io actually promotes
 * ("sheets can be shared into Discord as snapshot links") and the one whose
 * data this Worker already holds — the R2 bucket is bound for the snapshot API.
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
 * worth a 500 on a page that would otherwise render.
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
    return metaForSnapshot(stored, url.toString(), {
      image: `${url.origin}/icon-512.png`,
    })
  } catch {
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
    // on a real file.
    return new Response(shell.body, { status: 200, headers: shell.headers })
  }

  const headers = new Headers(shell.headers)
  // The body length changes with the injected metadata, and a stale
  // Content-Length truncates the document.
  headers.delete('content-length')
  return new Response(applyMeta(await shell.text(), meta), { status: 200, headers })
}

/** @public Cloudflare Worker entrypoint — loaded by workerd, not imported. */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    setSnapshotReporter((error, context) => {
      console.error('[itun]', error, context ?? {})
    })

    const url = new URL(request.url)
    const path = url.pathname

    // 1. Retired URL. 301 rather than 302: the screen is not coming back.
    //
    // NOT sufficient on its own, and the app carries a matching client-side
    // route. The service worker registers a NavigationRoute bound to a precached
    // index.html, so for anyone with the app installed or cached a navigation is
    // answered from Cache Storage and never reaches this Worker at all. This
    // covers first-time loads, crawlers and non-SW clients.
    const share = SHARE_PATH.exec(path)
    if (share) {
      return Response.redirect(`${url.origin}/sheet/${share[1]}/${share[2]}`, 301)
    }

    // 2 & 3. The snapshot API. Method-conditioned routing, which Cloudflare
    // cannot express declaratively — this is the piece netlify.toml did in
    // config and that therefore has to be tested rather than read.
    if (path === '/api/snapshots' || path.startsWith('/api/snapshots/')) {
      const storage = createR2Storage(env.SNAPSHOTS)

      if (path === '/api/snapshots') {
        if (request.method === 'POST' && env.RATE_LIMITER) {
          const { success } = await env.RATE_LIMITER.limit({ key: clientIp(request) })
          if (!success) return new Response('Too many requests', { status: 429 })
        }
        // The factory answers 405 for everything that is not POST, so the
        // non-POST branch needs no separate rule the way netlify.toml did.
        return makePublishHandler(storage, PUBLISH_OPTIONS)(request)
      }

      const id = path.slice('/api/snapshots/'.length)
      // Reject malformed ids before the handler so a DELETE for a nonsense id
      // cannot be mistaken for a retrieve.
      if (!isValidSnapshotId(id)) {
        return new Response('Invalid snapshot ID', { status: 400 })
      }

      // DELETE FIRST. Reversing these two is the mistake netlify.toml's comment
      // warns about: the retrieve rule has no method condition, so it would
      // swallow DELETE and answer 405.
      if (request.method === 'DELETE') {
        return makeDeleteHandler(storage, NO_IN_PROCESS_LIMIT)(request)
      }
      return makeRetrieveHandler(storage)(request)
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
    //    `/pilots/$id`, `/sheet/$kind/$id`, `/games/$gameId`. So a dot in the
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
  },
}
