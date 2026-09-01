/**
 * Serves Salvage Union entity artwork from R2 (ADR-033).
 *
 * The Cloudflare port of `netlify/functions/asset.ts`. Same URL grammar, same
 * content-type inference, same reporting policy — only the store changes:
 *
 *   https://assets.salvageunion.io/<category>/<file>  ->  R2 key <category>/<file>
 *
 * The bytes are licensed from Leyline Press ("used with special permission …
 * do not redistribute") and live only in object storage, never in git.
 *
 * ## Why the handler is a factory
 *
 * Identical reasoning to the Netlify version it replaces: injecting the bucket
 * lets the tests drive every branch without a live R2 binding, and injecting the
 * reporter lets them assert *which* outcomes are reported and which deliberately
 * are not. Both are the dependency-injection seam this repo uses instead of
 * `mock.module()`, which is process-global in Bun.
 *
 * ## What is reported, and what is not
 *
 * A 404 is not an error. This Worker answers every path on a public,
 * crawler-visible host, so alerting on unknown keys, traversal attempts and
 * unsupported extensions would turn the Sentry project into a scanner log. What
 * IS reported is the store failing to answer at all — the failure mode that
 * silently breaks entity artwork in both srd and itun at once.
 */

import type { ObservabilityEnv } from 'observability/cloudflare'
import { reportError, withObservability } from 'observability/cloudflare'

/** The slice of an R2 bucket binding this Worker uses. */
export type AssetBucket = {
  get(key: string): Promise<{ body: ReadableStream | null } | null>
}

/** The slice of the Cloudflare Images binding this Worker uses. */
export type ImagesBinding = {
  input(stream: ReadableStream): {
    transform(options: { width: number }): {
      output(options: { format: string }): Promise<{ response(): Response }>
    }
  }
}

/**
 * Widths this origin will render, and the reason it is an allowlist.
 *
 * Cloudflare Images bills by UNIQUE transformation, and the Free plan stops at
 * 5,000 per month. The width arrives in a public URL on an unauthenticated
 * origin, so an open range is an open invitation: a crawler walking
 * `-1.webp`, `-2.webp`, `-3.webp` would exhaust a month's quota in one pass and
 * every subsequent transformation on the account would fail with `9422`.
 *
 * Two entries, matching the render slot they exist for: `CardImage` sizes
 * artwork into 220 CSS px, so 440 covers a 2x display and 880 a 4x one. This is
 * the same pair `tools/generate-lp-asset-derivatives.ts` used to bake, which is
 * what makes the public URL grammar identical before and after.
 */
const ALLOWED_WIDTHS = new Set([440, 880])

/** The slice of workerd's ExecutionContext this Worker uses. */
export type ExecutionCtx = { waitUntil(promise: Promise<unknown>): void }

/**
 * The edge cache, or null where there isn't one.
 *
 * Two separate problems, resolved together so the call sites read as one idea —
 * the same shape as `edgeCache()` in `apps/itun/src/worker/index.ts`, which is
 * where this pattern was already proven:
 *
 *   - **Types.** `caches.default` is a Cloudflare extension to `CacheStorage`
 *     that the standard lib knows nothing about.
 *   - **Runtime.** Under `bun test` there is no `caches` global at all, and
 *     reading through it throws a ReferenceError. Returning null instead keeps
 *     "there is no cache here" from being indistinguishable from a real failure.
 *
 * ## Why this is needed at all
 *
 * `cache-control: immutable` only spares a browser that has ALREADY fetched the
 * byte. Cloudflare does not edge-cache a Worker's own response — that requires
 * an explicit `caches.default.put` — so before this, every artwork request from
 * every cold client worldwide cost one Worker invocation plus one billable R2
 * read. Measured on production: artwork responses carried no `cf-cache-status`
 * header at all, while srd's static assets on the same account returned `HIT`.
 */
function edgeCache(): Cache | null {
  if (typeof caches === 'undefined') return null
  return (caches as CacheStorage & { default?: Cache }).default ?? null
}

/** `chassis/mule-440.webp` -> `{ masterKey: 'chassis/mule.webp', width: 440 }`. */
function parseDerivative(key: string): { masterKey: string; width: number } | null {
  const match = /^(.*)-(\d+)(\.[a-z0-9]+)$/i.exec(key)
  if (!match) return null
  const [, stem, digits, ext] = match
  if (stem === undefined || digits === undefined || ext === undefined) return null
  return { masterKey: `${stem}${ext}`, width: Number(digits) }
}

export type AssetFailureReporter = (error: unknown, context?: Record<string, unknown>) => void

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
}

/**
 * Headers every response carries.
 *
 * `Access-Control-Allow-Origin: *` is required, not decorative: this host is
 * addressed cross-origin from both salvageunion.io and intheunionnow.com.
 *
 * The security headers match what the other two sites send (#778) — deliberately
 * including HSTS and X-Frame-Options. Being a pure CDN is not a reason to skip
 * them: HSTS still matters on a host served over TLS, and an image origin is a
 * fine thing to frame for a clickjacking overlay.
 *
 * No Content-Security-Policy: this origin serves image bytes and short error
 * strings, never HTML or script, so a CSP would govern nothing. That is also why
 * the Sentry `connect-src` clause the other two sites carry has no counterpart
 * here.
 */
const COMMON_HEADERS: Record<string, string> = {
  // `default-src 'none'; sandbox` because the extension allowlist admits `svg`,
  // and SVG is SCRIPT-CAPABLE: fetched by direct navigation it executes in this
  // origin. The block below used to justify having no CSP with "this origin
  // serves image bytes and short error strings, never HTML or script" — true of
  // the other formats, not of SVG.
  //
  // Defence in depth rather than a live hole: the R2 bucket has no user-write
  // path, so every object is one we uploaded. That is a fact about today's
  // deployment, not a property of the Worker, which is exactly the kind of
  // assumption worth not depending on.
  'content-security-policy': "default-src 'none'; sandbox",
  'access-control-allow-origin': '*',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'geolocation=(), microphone=(), camera=()',
  'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
  'x-dns-prefetch-control': 'on',
}

/**
 * Byte-for-byte what the Netlify site's `public/robots.txt` served. That file
 * is deleted in the same change: this Worker publishes no assets directory, so
 * it was an orphan asserting a policy nothing applied.
 *
 * This origin serves image bytes and short error strings — there is nothing here
 * a search index should hold, and the artwork is licensed. Disallowing all of it
 * is the intended posture, and was the posture until the cutover.
 */
const ROBOTS_TXT = 'User-agent: *\nDisallow: /\n'

function plain(body: string, status: number): Response {
  return new Response(body, { status, headers: COMMON_HEADERS })
}

export function makeAssetHandler(
  openBucket: () => AssetBucket,
  report: AssetFailureReporter = () => {},
  images?: ImagesBinding,
  ctx?: ExecutionCtx
) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return plain('Method not allowed', 405)
    }

    // Edge cache first. Only successful image responses are ever stored (see
    // `cached`), so a hit here is always a real asset — a 404 is cheap to
    // recompute and caching it would make a newly-uploaded image invisible for
    // as long as the negative entry lived.
    const cache = edgeCache()
    const hit = await cache?.match(req)
    if (hit) return hit

    const { pathname } = new URL(req.url)

    // `/robots.txt`, ahead of the extension check below — which does not know
    // `.txt` and would answer 404.
    //
    // The Netlify site published this from `public/`. This Worker has no assets
    // directory (its config says robots "is served from the Worker rather than
    // smuggled in as a second mechanism"), but no branch was ever written, so
    // after the cutover the path fell through to Cloudflare's zone-level managed
    // robots.txt — which carries content-signal comments and NO `Disallow`
    // directive at all. A robots.txt with no directives permits everything.
    //
    // That silently took this origin from "closed to every crawler" to "open",
    // and it holds artwork licensed from Leyline Press under
    // "do not redistribute". Restoring the original body is the whole fix.
    if (pathname === '/robots.txt') {
      return new Response(ROBOTS_TXT, {
        status: 200,
        headers: {
          ...COMMON_HEADERS,
          'content-type': 'text/plain; charset=utf-8',
          // Short, unlike the artwork: this is policy, and a year-long immutable
          // cache on a crawl directive is a year-long mistake if it changes.
          'cache-control': 'public, max-age=3600',
        },
      })
    }

    const key = decodeURIComponent(pathname.replace(/^\/+/, ''))

    // Reject empty keys, path traversal, and dotfiles. R2 keys are flat strings
    // so `..` has no traversal meaning to the store itself — but the check stays
    // because the URL grammar is shared with the Netlify version and a request
    // shaped like an escape attempt should never look like a hit.
    if (!key || key.includes('..') || key.startsWith('.')) {
      return plain('Not found', 404)
    }

    const ext = key.split('.').pop()?.toLowerCase() ?? ''
    const contentType = CONTENT_TYPES[ext]
    if (!contentType) {
      return plain('Unsupported asset type', 404)
    }

    // `openBucket()` is called INSIDE the try, not hoisted above it: the getter
    // itself can throw ("cannot open the store"), and that is one of the two
    // failures this 503 exists to report.
    let bucket: AssetBucket
    let object: { body: ReadableStream | null } | null
    try {
      bucket = openBucket()
      object = await bucket.get(key)
    } catch (error) {
      // A bucket that cannot answer breaks artwork for every visitor at once, so
      // it surfaces as a controlled 503 with an event rather than an unhandled
      // 500 nobody sees.
      report(error, { fn: 'asset', op: 'r2.get', key })
      return plain('Asset storage unavailable', 503)
    }

    // A stored object always wins. That is what keeps the 114 pre-baked
    // derivatives serving unchanged until someone prunes them, so this change
    // needs no coordinated bucket edit to be safe.
    if (object?.body) {
      return cached(req, imageResponse(object.body, contentType), cache, ctx)
    }

    // No stored object. If the key names a derivative, render it from the master
    // rather than 404ing — this is what replaces the baked pipeline.
    const derivative = parseDerivative(key)
    if (!derivative) {
      return plain('Not found', 404)
    }
    if (!ALLOWED_WIDTHS.has(derivative.width)) {
      // Not an error and deliberately not reported: an unallowed width is a
      // scanner or a stale link, and this origin is crawler-visible.
      return plain('Not found', 404)
    }
    if (!images) {
      // The binding is absent (local dev, or before the zone is configured).
      // 404 rather than 500: a missing derivative makes a browser fall back to
      // the `src` master, which is correct output, just larger.
      return plain('Not found', 404)
    }

    let master: { body: ReadableStream | null } | null
    try {
      master = await bucket.get(derivative.masterKey)
    } catch (error) {
      report(error, { fn: 'asset', op: 'r2.get', key: derivative.masterKey })
      return plain('Asset storage unavailable', 503)
    }
    if (!master?.body) {
      return plain('Not found', 404)
    }

    try {
      const rendered = await images
        .input(master.body)
        .transform({ width: derivative.width })
        .output({ format: contentType })
      return cached(
        req,
        imageResponse(rendered.response().body as ReadableStream, contentType),
        cache,
        ctx
      )
    } catch (error) {
      // A transformation failure IS worth reporting — unlike a 404 it means the
      // quota is exhausted (`9422`), the zone is misconfigured, or the master is
      // not a decodable image. All three break artwork silently and none is
      // visible from outside.
      report(error, { fn: 'asset', op: 'images.transform', key, width: derivative.width })
      return plain('Not found', 404)
    }
  }
}

/**
 * One image response, with the caching every path shares.
 *
 * Artwork is addressed by name and never mutated in place — a new image gets a
 * new name — so an immutable year is safe. A rendered derivative is equally
 * immutable: it is a pure function of a master that cannot change under it.
 */
/**
 * Store a successful image response at the edge and return it to the caller.
 *
 * The `put` runs under `waitUntil` rather than being awaited. Awaiting it would
 * serialize a cache write into every cache MISS's response time, which is
 * exactly the latency this change exists to remove — `apps/itun`'s og:image
 * path had that bug and is fixed alongside this one.
 *
 * The body must be `clone()`d because a Response body is a single-use stream:
 * hand the same one to both the cache and the client and whichever reads second
 * gets nothing.
 *
 * With no `ctx` (the tests, and any caller that does not pass one) the response
 * is returned uncached rather than the write being dropped silently.
 */
function cached(
  req: Request,
  response: Response,
  cache: Cache | null,
  ctx: ExecutionCtx | undefined
): Response {
  // GET only. The handler admits HEAD (see `makeAssetHandler`), and the Cache
  // API throws a TypeError on a non-GET `put` — inside `waitUntil`, where the
  // response has already been returned, so the request still succeeds and the
  // failure is invisible. Every HEAD was quietly throwing here.
  //
  // The test double accepted any method, which is why the suite could not see
  // it; `edgeCache.test.ts` now has a fake that throws on non-GET, matching the
  // real API.
  if (cache && ctx && req.method === 'GET') ctx.waitUntil(cache.put(req, response.clone()))
  return response
}

function imageResponse(body: ReadableStream, contentType: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      ...COMMON_HEADERS,
      'content-type': contentType,
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}

export type Env = ObservabilityEnv & {
  LP_ASSETS: AssetBucket
  /** Cloudflare Images. Optional: absent means derivatives 404 rather than crash. */
  IMAGES?: ImagesBinding
}

/** @public Cloudflare Worker entrypoint — loaded by workerd, not imported. */
export default withObservability('su-assets', {
  // `ctx` is optional in the SIGNATURE only. workerd always supplies it; the
  // parameter is optional so the routing tests can call this entrypoint with
  // two arguments, and because every use of it is already null-guarded — a
  // missing ctx costs the edge-cache write, not correctness.
  async fetch(request: Request, env: Env, ctx?: ExecutionCtx): Promise<Response> {
    const handler = makeAssetHandler(
      () => env.LP_ASSETS,
      (error, context) => {
        // Both, deliberately: Workers Logs is what `wrangler tail` shows during
        // an incident, Sentry is what alerts. Dropping either trades one blind
        // spot for another.
        console.error('[su-assets]', error, context ?? {})
        reportError(error, context)
      },
      env.IMAGES,
      ctx
    )
    try {
      return await handler(request)
    } catch (error) {
      // Nothing above should reach here — the store call has its own catch — so
      // anything that does is a bug in this Worker rather than a storage
      // outage, and is worth logging precisely because it was never anticipated.
      console.error('[su-assets] unhandled', error)
      reportError(error, { fn: 'asset', op: 'unhandled' })
      return plain('Internal Server Error', 500)
    }
  },
})
