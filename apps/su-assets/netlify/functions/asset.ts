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

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
}

export default async (req: Request): Promise<Response> => {
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

  const store = getStore('lp-assets')
  const stream = await store.get(key, { type: 'stream' })
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

// Functions v2 in-code routing: this function handles every path on the site.
export const config = {
  path: '/*',
}
