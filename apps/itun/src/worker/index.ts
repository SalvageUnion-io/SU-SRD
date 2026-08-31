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
 * Enforced at the edge by Cloudflare's Rate Limiting binding, declared as
 * `ratelimits` in `wrangler.jsonc` and applied to POST below.
 *
 * The Netlify handler's module-scope `RateLimiter{10/min}` was deliberately not
 * ported (P3): it counted per Function instance and would count per isolate
 * here, which is approximate to the point of being decorative. `handlers.ts` no
 * longer carries it at all — it was only ever the default so Netlify's
 * behaviour stayed unchanged during the migration, and that host is gone.
 *
 * `RATE_LIMITER` is Cloudflare's own binding, which is a real control because it
 * is enforced at the edge rather than per-instance. It is optional here so the
 * Worker still runs without it.
 *
 * That tolerance is not a claim that its absence is harmless, and this comment
 * used to say it was — "the same protection the 256 KB cap already provides".
 * The cap bounds bytes PER REQUEST, not requests, so it bounds nothing about
 * how many a caller may make. The binding was in fact unprovisioned through
 * P4-P7 while this paragraph called it a real control, and the endpoint took
 * unlimited unauthenticated POSTs into billable R2. `wrangler.jsonc` declares
 * it now, and `__tests__/rateLimitBinding.test.ts` fails if that is removed.
 */

import type { ObservabilityEnv } from 'observability/cloudflare'
import { reportError, withObservability } from 'observability/cloudflare'
import {
  makeDeleteHandler,
  makePublishHandler,
  makeRetrieveHandler,
} from '../lib/snapshot/handlers'
import { isValidSnapshotId } from '../lib/snapshot/id'
import { setSnapshotReporter } from '../lib/snapshot/report'
import type { R2BucketLike } from '../lib/snapshot/storage'
import { createR2Storage } from '../lib/snapshot/storage'
import type { ShellMeta } from './shellMeta'
import { applyMeta, metaForSnapshot } from './shellMeta'

/** The slice of workerd's ExecutionContext this Worker uses. */
type ExecutionCtx = { waitUntil(promise: Promise<unknown>): void }

/** Cloudflare's Rate Limiting binding, as much of it as this Worker uses. */
type RateLimiterBinding = {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

export type Env = ObservabilityEnv & {
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

/** `/og/s/<id>.png` — the rendered preview for a shared snapshot. */
const OG_ROUTE = /^\/og\/s\/([^/]+)\.png$/

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
      image: `${url.origin}/og/s/${id}.png`,
    })
  } catch {
    return null
  }
}

/**
 * The edge cache, or null where there isn't one.
 *
 * Two separate problems, both resolved here so the call site reads as one idea:
 *
 *   - **Types.** `caches.default` is a Cloudflare extension to `CacheStorage`,
 *     and this app's tsconfig loads the DOM lib — it is a browser app that
 *     happens to contain a Worker — so the standard type wins and knows nothing
 *     about `default`.
 *   - **Runtime.** Under `bun test` there is no `caches` global at all, and
 *     reading through it throws a ReferenceError that `ogImage`'s catch would
 *     swallow into a fallback. That would make "the renderer is broken" and
 *     "there is no cache here" produce the same 302, which is exactly the kind
 *     of collapse that hides a real failure.
 */
function edgeCache(): Cache | null {
  if (typeof caches === 'undefined') return null
  return (caches as CacheStorage & { default?: Cache }).default ?? null
}

/**
 * Serve the rendered preview for a shared snapshot.
 *
 * Every failure path ends at the static icon rather than an error. An unfurl
 * that is slightly generic is fine; one that 404s or hangs makes the link look
 * broken in the channel it was pasted into, which is worse than no image.
 *
 * Cached in the Cache API keyed on the request URL. A snapshot is FROZEN once
 * published (that is what distinguishes it from a public sheet), so the render
 * can never go stale and there is nothing to invalidate on.
 */
async function ogImage(
  request: Request,
  env: Env,
  id: string,
  ctx: ExecutionCtx | undefined
): Promise<Response> {
  const url = new URL(request.url)
  const fallback = () => Response.redirect(`${url.origin}/icon-512.png`, 302)

  if (!isValidSnapshotId(id)) return fallback()

  const cache = edgeCache()
  const hit = await cache?.match(request)
  if (hit) return hit

  try {
    const stored = await createR2Storage(env.SNAPSHOTS).get(id)
    if (!stored) return fallback()

    const meta = metaForSnapshot(stored, url.toString(), { image: '' })
    if (!meta) return fallback()

    // `renderOgImage` is imported lazily so the ~2.4 MB resvg wasm and the two
    // embedded TTFs stay out of the startup path of every OTHER route. They are
    // in the same bundle either way; this keeps them off the critical path of a
    // page load.
    const { renderOgImage } = await import('./ogImage')
    const [name, kind] = meta.title.split(' — ')
    // The description opens with "<Kind>: <Name>." — which the card already
    // shows, in larger type, directly above this line. Drop the lead so the
    // detail row carries something the reader has not just read.
    const detail = meta.description.replace(/^[^:]+:\s*[^.]+\.\s*/, '')
    const png = await renderOgImage(name ?? 'Sheet', kind ?? 'Sheet', detail || null)

    const response = new Response(png as BodyInit, {
      headers: {
        'content-type': 'image/png',
        // Immutable: a snapshot never changes, and its id is content-addressed.
        'cache-control': 'public, max-age=31536000, immutable',
      },
    })
    // `waitUntil`, not `await`: awaiting serializes the cache write into every
    // MISS's response time for no benefit to that caller. With no ctx the
    // response is simply returned uncached rather than the write being dropped
    // silently. The clone is required — a Response body is a single-use stream,
    // so handing the same one to the cache and the client starves whichever
    // reads second.
    if (cache && ctx) ctx.waitUntil(cache.put(request, response.clone()))
    return response
  } catch (error) {
    console.error('[itun] og:image render failed', error)
    return fallback()
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
export default withObservability('itun', {
  // `ctx` is optional in the SIGNATURE only. workerd always supplies it; the
  // parameter is optional so the routing tests can call this entrypoint with
  // two arguments, and because every use of it is already null-guarded — a
  // missing ctx costs the edge-cache write, not correctness.
  async fetch(request: Request, env: Env, ctx?: ExecutionCtx): Promise<Response> {
    setSnapshotReporter((error, context) => {
      // Both, deliberately: Workers Logs is what `wrangler tail` shows during an
      // incident, Sentry is what alerts.
      console.error('[itun]', error, context ?? {})
      reportError(error, context)
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
        return makePublishHandler(storage)(request)
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
        return makeDeleteHandler(storage)(request)
      }
      return makeRetrieveHandler(storage)(request)
    }

    // 3b. The rendered og:image. Ahead of the asset lookup because `/og/s/*`
    //     is not on disk, and ahead of rule 6 because it ends in `.png` and
    //     would otherwise 404 as a missing file.
    const og = OG_ROUTE.exec(path)
    if (og?.[1]) return ogImage(request, env, og[1], ctx)

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
})
