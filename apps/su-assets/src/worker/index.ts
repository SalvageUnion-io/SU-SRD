/**
 * Serves Salvage Union entity artwork from R2 (ADR-033).
 *
 * One URL grammar, mapped straight onto R2 keys:
 *
 *   https://assets.salvageunion.io/<category>/<file>  ->  R2 key <category>/<file>
 *
 * The bytes are licensed from Leyline Press ("used with special permission …
 * do not redistribute") and live only in object storage, never in git.
 *
 * ## Why the handler is a factory
 *
 * Injecting the bucket lets the tests drive every branch without a live R2
 * binding — the dependency-injection seam this repo uses instead of
 * `mock.module()`, which is process-global in Bun. Failures go to `reportError`
 * directly; the tests spy on it to assert *which* outcomes are reported and
 * which deliberately are not.
 *
 * ## What is reported, and what is not
 *
 * A 404 is not an error. This Worker answers every path on a public,
 * crawler-visible host, so alerting on unknown keys, traversal attempts and
 * unsupported extensions would turn Workers Issues into a scanner log. What
 * IS reported is the store failing to answer at all — the failure mode that
 * silently breaks entity artwork in both the reference site and the app at once.
 */

import {
  ASSET_RENDER_QUALITY,
  isServedDerivative,
  parseAssetDerivative,
} from 'salvageunion-reference/assetDerivatives'
import { reportError } from './reportError'

/** The slice of an R2 bucket binding this Worker uses. */
export type AssetBucket = {
  get(key: string): Promise<{ body: ReadableStream | null } | null>
}

/** The slice of the Cloudflare Images binding this Worker uses. */
export type ImagesBinding = {
  input(stream: ReadableStream): {
    transform(options: { width: number }): {
      output(options: { format: string; quality?: number }): Promise<{ response(): Response }>
    }
  }
}

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
 * The security headers the reference site and the app send from `public/_headers` (`/*`), which
 * Static Assets applies there and nothing applies here: this Worker builds every
 * response itself. `headers.test.ts` holds the two in agreement.
 */
export const BASE_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'geolocation=(), microphone=(), camera=()',
  'strict-transport-security': 'max-age=63072000; includeSubDomains',
  'x-dns-prefetch-control': 'on',
}

/**
 * Headers every response carries.
 *
 * `Access-Control-Allow-Origin: *` is required, not decorative: this host is
 * addressed cross-origin from salvageunion.io (the SRD, and the app under /build).
 *
 * `default-src 'none'; sandbox` because the extension allowlist admits `svg`,
 * and SVG is script-capable: fetched by direct navigation it executes in this
 * origin.
 */
const COMMON_HEADERS: Record<string, string> = {
  ...BASE_SECURITY_HEADERS,
  'content-security-policy': "default-src 'none'; sandbox",
  'access-control-allow-origin': '*',
}

/**
 * This origin serves image bytes and short error strings — there is nothing here
 * a search index should hold, and the artwork is licensed. Disallowing all of it
 * is the intended posture.
 */
const ROBOTS_TXT = 'User-agent: *\nDisallow: /\n'

/**
 * Every error and 404 says `no-store`. Workers Caching (`cache.enabled` in
 * wrangler.jsonc) stores what `Cache-Control` allows, and a 404 without one is
 * left to heuristics — a cached negative entry hides a newly uploaded image for
 * as long as it lives.
 */
function plain(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { ...COMMON_HEADERS, 'cache-control': 'no-store' },
  })
}

export function makeAssetHandler(openBucket: () => AssetBucket, images?: ImagesBinding) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return plain('Method not allowed', 405)
    }

    const { pathname } = new URL(req.url)

    // `/robots.txt`, ahead of the extension check below — which does not know
    // `.txt` and would answer 404.
    //
    // This Worker has no assets directory, so without this branch the path
    // falls through to Cloudflare's zone-level managed robots.txt, which has NO
    // `Disallow` directive and so permits every crawler — on an origin holding
    // artwork licensed under "do not redistribute".
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

    // A malformed percent-escape (`%E0%A4%A`) makes `decodeURIComponent` throw.
    // That is a scanner or a mangled link, not a fault: a quiet 404 like any
    // other miss, rather than a 500 that Workers Issues records.
    let key: string
    try {
      key = decodeURIComponent(pathname.replace(/^\/+/, ''))
    } catch {
      return plain('Not found', 404)
    }

    // Reject empty keys, path traversal, and dotfiles. R2 keys are flat strings
    // so `..` has no traversal meaning to the store itself — but a request
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
      reportError(error, { fn: 'asset', op: 'r2.get', key })
      return plain('Asset storage unavailable', 503)
    }

    // A stored object always wins over a rendered derivative, so any derivative
    // still in the bucket keeps serving until it is pruned.
    if (object?.body) {
      return imageResponse(object.body, contentType)
    }

    // No stored object. If the key names a derivative, render it from the master
    // rather than 404ing.
    // The widths and the quality are an allowlist owned by the reference
    // package (`salvageunion-reference/assetDerivatives`), which the app's
    // `srcset` reads too: an open range would let a crawler exhaust the
    // Cloudflare Images quota.
    const derivative = parseAssetDerivative(key)
    if (!derivative) {
      return plain('Not found', 404)
    }
    if (!isServedDerivative(derivative)) {
      // Not an error and deliberately not reported: an unallowed width or
      // quality is a scanner or a stale link, and this origin is crawler-visible.
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
      reportError(error, { fn: 'asset', op: 'r2.get', key: derivative.masterKey })
      return plain('Asset storage unavailable', 503)
    }
    if (!master?.body) {
      return plain('Not found', 404)
    }

    try {
      const rendered = await images
        .input(master.body)
        .transform({ width: derivative.width })
        .output({ format: contentType, quality: ASSET_RENDER_QUALITY })
      return imageResponse(rendered.response().body as ReadableStream, contentType)
    } catch (error) {
      // A transformation failure IS worth reporting — unlike a 404 it means the
      // quota is exhausted (`9422`), the zone is misconfigured, or the master is
      // not a decodable image. All three break artwork silently and none is
      // visible from outside.
      reportError(error, { fn: 'asset', op: 'images.transform', key, width: derivative.width })
      return plain('Not found', 404)
    }
  }
}

/**
 * One image response. Artwork is addressed by name and never mutated in place,
 * and a derivative is a pure function of its master, so an immutable year is
 * safe — and it is what lets Workers Caching answer a repeat request at the edge
 * without running this Worker or Cloudflare Images again.
 */
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

/** @public Cloudflare Worker entrypoint — loaded by workerd, not imported. */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const handler = makeAssetHandler(() => env.LP_ASSETS, env.IMAGES)
    try {
      return await handler(request)
    } catch (error) {
      // Nothing above should reach here — the store call has its own catch — so
      // anything that does is a bug in this Worker rather than a storage
      // outage, and is worth logging precisely because it was never anticipated.
      reportError(error, { fn: 'asset', op: 'unhandled' })
      return plain('Internal Server Error', 500)
    }
  },
}
