/**
 * HTTP pieces the two asset-serving Workers (`apps/itun`, `apps/su-assets`)
 * were each carrying a copy of (audit AP-12).
 *
 * It lives in this package because this is already the one module every Worker
 * depends on for its platform wiring, and a fourth workspace for a dozen lines
 * would cost a manifest, a CI path filter, a knip entry and a coverage slot. It
 * imports nothing, so a Worker that takes it pays for exactly these lines.
 */

/**
 * The edge cache, or null where there isn't one.
 *
 * Two separate problems, resolved together so a call site reads as one idea:
 *
 *   - **Types.** `caches.default` is a Cloudflare extension to `CacheStorage`
 *     that the standard lib knows nothing about — and itun's tsconfig loads
 *     the DOM lib (it is a browser app that happens to contain a Worker), so
 *     the standard type wins.
 *   - **Runtime.** Under `bun test` there is no `caches` global at all, and
 *     reading through it throws a ReferenceError. Returning null keeps "there
 *     is no cache here" from being indistinguishable from a real failure,
 *     which a caller's catch-all would otherwise collapse into its fallback.
 *
 * Why an explicit cache at all: `cache-control: immutable` only spares a
 * browser that has ALREADY fetched the bytes. Cloudflare does not edge-cache a
 * Worker's own response — that takes a `caches.default.put`.
 */
export function edgeCache(): Cache | null {
  if (typeof caches === 'undefined') return null
  return (caches as CacheStorage & { default?: Cache }).default ?? null
}

/** For content-addressed bytes that never change under their URL. */
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable'

/**
 * The security headers every Worker-served origin sends, whatever it serves.
 *
 * Deliberately NOT a Content-Security-Policy: that is per-surface (itun's must
 * admit Sentry's ingest and Convex; su-assets serves only bytes and uses
 * `default-src 'none'; sandbox`), so each Worker adds its own. Spread this
 * first and the Worker's own entries after, so a surface can override one.
 *
 * Keep in step with the static sites' `public/_headers`, which carry the same
 * six for the requests no Worker script handles.
 */
export const BASE_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'geolocation=(), microphone=(), camera=()',
  'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
  'x-dns-prefetch-control': 'on',
}
