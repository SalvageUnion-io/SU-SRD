/**
 * intheunionnow.com — the ITUN SPA, on Workers (ADR-033), plus what is left of
 * the retired snapshot shares (ADR-036): one read, and the unfurl of links
 * already posted.
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
 *   3b. `/og/s/:id.png`        → the rendered unfurl image for an old link.
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
 * which `src/lib/chunkRecovery.ts` recovers from with a single reload.
 *
 * ## The unfurl stays, for links already posted
 *
 * Snapshot links are still in Discord channels, and Discord re-fetches an
 * unfurl. So `/s/:id` keeps its per-snapshot shell metadata and `/og/s/:id.png`
 * keeps rendering its card — a neutral title naming the entity, read from the
 * stored blob. Opening the link never shows that build: the client resolves it
 * to the live public sheet or the retired page. The pipeline (resvg wasm, fonts,
 * `ogCard.ts`, `OG_METRICS`) is removed together with `@resvg/resvg-wasm` once
 * the dependency audit gate can pass a PR that changes `bun.lock` (ADR-036).
 *
 * ## No rate limiter
 *
 * Cloudflare's Rate Limiting binding (`RATE_LIMITER`) covered `POST
 * /api/snapshots` and nothing else, and went with it. Reads were never limited.
 */

import type { ObservabilityEnv } from 'observability/cloudflare'
import { reportError, withObservability } from 'observability/cloudflare'
import { edgeCache, IMMUTABLE_CACHE_CONTROL } from 'observability/worker-http'
import { makeIdentityHandler } from '../lib/snapshot/handlers'
import { isValidSnapshotId } from '../lib/snapshot/id'
import { setSnapshotReporter } from '../lib/snapshot/report'
import type { R2BucketLike } from '../lib/snapshot/storage'
import { createR2Storage } from '../lib/snapshot/storage'
import { retiredRedirect } from './retiredRoutes'
import { withSecurityHeaders } from './securityHeaders'
import type { ShellMeta } from './shellMeta'
import { applyMeta, metaForSnapshot } from './shellMeta'

/** The slice of workerd's ExecutionContext this Worker uses. */
type ExecutionCtx = { waitUntil(promise: Promise<unknown>): void }

export type Env = ObservabilityEnv & {
  /** Static assets (the built SPA). `not_found_handling` is "none" — see above. */
  ASSETS: { fetch(request: Request): Promise<Response> }
  /** The retired snapshot store — read, never written (ADR-036). */
  SNAPSHOTS: R2BucketLike
  /**
   * Optional. Absent means no measurement, not a crash, so a local `wrangler
   * dev` and the routing tests need no binding. See the OG open question below
   * for what this exists to answer.
   */
  OG_METRICS?: AnalyticsEngineDataset
}

/** The write half of a Workers Analytics Engine dataset — the only half a Worker has. */
type AnalyticsEngineDataset = {
  writeDataPoint(event: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void
}

const SNAPSHOT_ROUTE = /^\/s\/([^/]+)\/?$/

/** `/og/s/<id>.png` — the rendered preview for a shared snapshot. */
const OG_ROUTE = /^\/og\/s\/([^/]+)\.png$/

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
    return metaForSnapshot(stored, url.toString(), {
      image: `${url.origin}/og/s/${id}.png`,
    })
  } catch (error) {
    reportError(error, { source: 'metaForRoute', id })
    return null
  }
}

/**
 * ## OPEN QUESTION: does this fit the Free plan's CPU budget?
 *
 * Benchmarked locally on Apple silicon, `renderOgImage` took **47.6 ms cold**
 * and then ~15 ms warm. The documented budget is **10 ms CPU per invocation**
 * on Workers Free (ADR-033 §6), and edge CPUs are
 * slower than that laptop.
 *
 * If it does exceed the limit the failure is bad in a specific way: **a CPU-limit
 * kill is not a catchable exception**, so the `fallback()` below — carefully
 * built so an unfurl degrades to the site icon rather than a broken image —
 * never runs. The unfurl gets a Cloudflare error page instead.
 *
 * This is UNVERIFIED. It was never sized against the ceiling, and a local
 * benchmark is not evidence about workerd. It is deliberately not "fixed" on
 * that basis, and with publishing retired (ADR-036) there is no publish step
 * left to pre-render at: the pipeline only serves links already posted, and is
 * removed with `@resvg/resvg-wasm` once the dependency audit gate allows it.
 *
 * ## How to settle it
 *
 *     cd apps/itun && bunx wrangler tail su-itun --format=pretty | grep 'og:image'
 *
 * then request `https://intheunionnow.com/og/s/<a real snapshot id>.png` with a
 * cache-busting query string. Read `cpuTime` from the tail entry — NOT the
 * `wallMs` the log line prints, which measures I/O waits and is only there to
 * make the entry greppable.
 *
 * Take a cold reading and a warm one: the wasm instantiation is the expensive
 * half, and the cache means most real requests never reach this code at all.
 *
 * If `cpuTime` is near or over 10 ms, the cheapest honest answer now is to
 * retire the image early (301 `/og/s/*` to the app icon in `retiredRoutes.ts`)
 * rather than build a pre-render for a surface that is being removed.
 */
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
    const startedAt = Date.now()
    const [name, kind] = meta.title.split(' — ')
    // The description opens with "<Kind>: <Name>." — which the card already
    // shows, in larger type, directly above this line. Drop the lead so the
    // detail row carries something the reader has not just read.
    const detail = meta.description.replace(/^[^:]+:\s*[^.]+\.\s*/, '')
    const png = await renderOgImage(name ?? 'Sheet', kind ?? 'Sheet', detail || null)

    // MEASUREMENT, not instrumentation to keep. See the block above `ogImage`.
    //
    // `Date.now()` in a Worker advances only on I/O, so between two points of
    // pure CPU it returns the SAME value — which is exactly what makes it
    // useful here rather than misleading: a non-zero duration means the render
    // yielded, and the number to trust is the `cpuTime` that `wrangler tail`
    // reports for the whole invocation. This line exists to make the
    // corresponding tail entry findable by grep.
    // Written to Workers Analytics Engine, not just logged.
    //
    // This was a `console.log` whose own comment said to remove it "once that
    // [open question] is answered" — but a log line in `wrangler tail` is only
    // visible to someone already tailing during a render, so it could never
    // answer it. A datapoint aggregates: `wallMs` percentiles across real
    // traffic, split by whether the render was a cold start, is exactly the
    // evidence the question needs.
    //
    // Wall time still is not CPU time (see above), so this narrows the question
    // rather than closing it: a p99 wallMs comfortably under 10 ms is strong
    // evidence, and anything above it is a reason to look at the invocation's
    // reported cpuTime.
    //
    // Optional binding, so an absent dataset degrades to no measurement.
    const wallMs = Date.now() - startedAt
    env.OG_METRICS?.writeDataPoint({
      indexes: [id.slice(0, 1)],
      doubles: [wallMs, png.byteLength],
      blobs: ['og-render'],
    })

    const response = new Response(png as BodyInit, {
      headers: {
        'content-type': 'image/png',
        // Immutable: a snapshot never changes, and its id is content-addressed.
        'cache-control': IMMUTABLE_CACHE_CONTROL,
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
export default withObservability('itun', {
  // `ctx` is optional in the SIGNATURE only. workerd always supplies it; the
  // parameter is optional so the routing tests can call this entrypoint with
  // two arguments, and because every use of it is already null-guarded — a
  // missing ctx costs the edge-cache write, not correctness.
  async fetch(request: Request, env: Env, ctx?: ExecutionCtx): Promise<Response> {
    // Wrapped once, here, rather than at each `return`. There are nine exit
    // paths below and a tenth would otherwise ship bare — which is exactly how
    // the ones that existed came to.
    return withSecurityHeaders(await route(request, env, ctx))
  },
})

async function route(request: Request, env: Env, ctx?: ExecutionCtx): Promise<Response> {
  setSnapshotReporter((error, context) => {
    // Both, deliberately: Workers Logs is what `wrangler tail` shows during an
    // incident, Sentry is what alerts.
    console.error('[itun]', error, context ?? {})
    reportError(error, context)
  })

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

  // 3b. The rendered og:image for an old link. Ahead of the asset lookup because `/og/s/*`
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
