/**
 * Serves Salvage Union entity artwork from the "lp-assets" Netlify Blobs store.
 *
 * URL shape:  https://assets.salvageunion.io/<category>/<file>
 *   e.g.      https://assets.salvageunion.io/chassis/iron-mongrel.jpg
 *   → blob key: chassis/iron-mongrel.jpg
 *
 * The bytes live only in Blobs (never in git). Content-Type is inferred from
 * the file extension — no per-blob metadata required, so uploads can be done
 * with `netlify blobs:set` directly.
 *
 * Responses are marked immutable so the Netlify edge caches them and this
 * function runs only on a cache miss. Artwork is addressed by name and never
 * mutated in place (a new image gets a new name).
 */
import { getStore } from '@netlify/blobs'
import { captureException, initObservability } from '../lib/observability'

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
 * The slice of a Netlify Blobs store this function actually uses. Declaring it
 * structurally lets the tests inject a fake without a live Blobs runtime — the
 * same dependency-injection seam the ITUN snapshot handlers use, chosen over
 * `mock.module()` for the same reason (it is process-global).
 */
export type AssetBlobStore = {
  get(key: string, options: { type: 'stream' }): Promise<ReadableStream | null>
}

/**
 * How a failure is reported. Injected for the same reason the store is — the
 * tests assert *which* outcomes reach Sentry and which deliberately do not,
 * and doing that with `mock.module('@sentry/node')` would rewrite the module
 * registry for the whole test process.
 */
export type AssetFailureReporter = (error: unknown, context?: Record<string, unknown>) => void

/**
 * Handler factory. The store getter is invoked per request (never at module
 * scope) because `getStore` requires the Netlify Functions runtime context.
 *
 * On reporting: a 404 is not an error here. A request for a key that is not in
 * the store, a path that fails the traversal guard, or an extension outside the
 * allowlist are all ordinary outcomes on a public, crawler-visible host — this
 * function answers every path on `assets.salvageunion.io`, so alerting on them
 * would turn the Sentry project into a scanner log. What IS reported is the
 * store failing to answer at all, which is the failure mode that silently
 * breaks entity artwork in both srd and itun.
 */
export const makeAssetHandler =
  (openStore: () => AssetBlobStore, report: AssetFailureReporter = captureException) =>
  async (req: Request): Promise<Response> => {
    const { pathname } = new URL(req.url)
    const key = decodeURIComponent(pathname.replace(/^\/+/, ''))

    // Reject empty keys, path traversal, and dotfiles.
    if (!key || key.includes('..') || key.startsWith('.')) {
      return new Response('Not found', { status: 404 })
    }

    const ext = key.split('.').pop()?.toLowerCase() ?? ''
    const contentType = CONTENT_TYPES[ext]
    if (!contentType) {
      return new Response('Unsupported asset type', { status: 404 })
    }

    // Opening the store and reading from it are one failure domain: `getStore`
    // throws when the Blobs runtime context or the store binding is missing,
    // and `get` rejects on a Blobs outage. Either way artwork stops serving for
    // every visitor at once, so it surfaces as a controlled 503 with a Sentry
    // event rather than an unhandled 500 nobody sees.
    let stream: ReadableStream | null
    try {
      stream = await openStore().get(key, { type: 'stream' })
    } catch (error) {
      report(error, { fn: 'asset', op: 'blobs.get', key })
      return new Response('Asset storage unavailable', { status: 503 })
    }

    if (!stream) {
      return new Response('Not found', { status: 404 })
    }

    return new Response(stream, {
      status: 200,
      headers: {
        'content-type': contentType,
        'cache-control': 'public, max-age=31536000, immutable',
        'netlify-cdn-cache-control': 'public, max-age=31536000, immutable',
        'access-control-allow-origin': '*',
      },
    })
  }

const handler = makeAssetHandler(() => getStore('lp-assets'))

/** @public Netlify Functions handler — invoked by the platform, not imported. */
export default async function (req: Request): Promise<Response> {
  initObservability()
  try {
    return await handler(req)
  } catch (error) {
    // Nothing above should reach here — the store call has its own catch — so
    // anything that does is a bug in this function rather than a Blobs outage,
    // and is worth an event precisely because it was never anticipated.
    captureException(error, { fn: 'asset' })
    return new Response('Internal Server Error', { status: 500 })
  }
}

// Functions v2 in-code routing: this function handles every path on the site.
export const config = {
  path: '/*',
}
