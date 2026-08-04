/**
 * Handler-level tests for the assets.salvageunion.io artwork function.
 *
 * This is the one internet-facing endpoint in this workspace, and both srd and
 * itun resolve every entity-card image through it, so the key-sanitising guard
 * is the security-relevant behaviour worth pinning: the request path becomes a
 * Blobs key more or less verbatim, and the guard plus the extension allowlist
 * are all that stand between a URL and a store lookup.
 *
 * The store is injected via `makeAssetHandler` (dependency injection, no
 * `mock.module()` — that is process-global), mirroring
 * apps/itun/netlify/functions/__tests__/snapshot.test.ts.
 *
 * Assertion style: toBe() / toEqual() — not toBeInTheDocument().
 */

import { describe, expect, it } from 'bun:test'
import type { AssetBlobStore } from '../asset'
import { makeAssetHandler } from '../asset'

const BASE = 'https://assets.salvageunion.io'

/** Records every key the handler looks up, so a rejection can assert it looked up nothing. */
function makeStore(contents: Record<string, string>) {
  const requested: string[] = []
  const store: AssetBlobStore = {
    get: async (key: string) => {
      requested.push(key)
      const body = contents[key]
      if (body === undefined) return null
      return new Response(body).body
    },
  }
  return { store, requested }
}

function handlerWith(contents: Record<string, string> = {}) {
  const { store, requested } = makeStore(contents)
  return { handler: makeAssetHandler(() => store), requested }
}

const get = (path: string) => new Request(`${BASE}${path}`)

describe('asset function — key guard', () => {
  // These are the shapes that actually survive URL parsing with a `..` or a
  // leading dot intact. A *literal* `../` is folded away by the WHATWG URL
  // parser before the handler ever sees it (covered separately below), so the
  // guard's real job is the percent-encoded form, which the parser preserves.
  const rejected: Array<[label: string, path: string]> = [
    ['encoded traversal separator', '/chassis/..%2Fsecrets.png'],
    ['fully encoded traversal', '/%2e%2e%2fsecrets.png'],
    ['repeated encoded traversal', '/chassis/..%2f..%2fsecrets.png'],
    ['leading dotfile', '/.env.png'],
    ['encoded leading dotfile', '/%2Esecret.png'],
    ['empty key (site root)', '/'],
    ['empty key (repeated slashes)', '///'],
  ]

  for (const [label, path] of rejected) {
    it(`404s on ${label} without touching the store`, async () => {
      const { handler, requested } = handlerWith({ 'chassis/iron-mongrel.png': 'bytes' })
      const res = await handler(get(path))

      expect(res.status).toBe(404)
      expect(await res.text()).toBe('Not found')
      expect(requested).toEqual([])
    })
  }

  it('rejects an encoded traversal even when the extension is allowlisted', async () => {
    // The guard must run before the extension allowlist, or an encoded `..`
    // sails through on any path that happens to end in .png.
    const { handler, requested } = handlerWith()
    const res = await handler(get('/a/..%2f..%2fb.png'))

    expect(res.status).toBe(404)
    expect(await res.text()).toBe('Not found')
    expect(requested).toEqual([])
  })

  it('never asks the store for a key containing a traversal segment', async () => {
    // Defence in depth: a literal `../` is normalised away by `new URL()`, so
    // these resolve to an ordinary in-store lookup rather than 404ing. What
    // must hold either way is that nothing reaching the store can escape the
    // store's own namespace.
    for (const path of ['/chassis/../../etc/passwd.png', '/../secrets.png', '/a/../../b.png']) {
      const { handler, requested } = handlerWith()
      const res = await handler(get(path))

      expect(res.status).toBe(404)
      for (const key of requested) {
        expect(key.includes('..')).toBe(false)
        expect(key.startsWith('.')).toBe(false)
        expect(key.startsWith('/')).toBe(false)
      }
    }
  })
})

describe('asset function — extension allowlist', () => {
  for (const path of ['/notes.txt', '/page.html', '/script.js', '/chassis/iron-mongrel']) {
    it(`404s on an unlisted extension: ${path}`, async () => {
      const { handler, requested } = handlerWith()
      const res = await handler(get(path))

      expect(res.status).toBe(404)
      expect(await res.text()).toBe('Unsupported asset type')
      expect(requested).toEqual([])
    })
  }

  it('accepts every allowlisted extension, case-insensitively', async () => {
    const cases: Array<[path: string, contentType: string]> = [
      ['/a.png', 'image/png'],
      ['/a.jpg', 'image/jpeg'],
      ['/a.jpeg', 'image/jpeg'],
      ['/a.webp', 'image/webp'],
      ['/a.gif', 'image/gif'],
      ['/a.avif', 'image/avif'],
      ['/a.svg', 'image/svg+xml'],
      ['/a.PNG', 'image/png'],
    ]

    for (const [path, contentType] of cases) {
      const key = path.slice(1)
      const { handler } = handlerWith({ [key]: 'bytes' })
      const res = await handler(get(path))

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe(contentType)
    }
  })
})

describe('asset function — hits', () => {
  it('streams a stored blob with immutable cache headers', async () => {
    const { handler, requested } = handlerWith({ 'chassis/iron-mongrel.png': 'PNGBYTES' })
    const res = await handler(get('/chassis/iron-mongrel.png'))

    expect(res.status).toBe(200)
    expect(requested).toEqual(['chassis/iron-mongrel.png'])
    expect(await res.text()).toBe('PNGBYTES')
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(res.headers.get('netlify-cdn-cache-control')).toBe('public, max-age=31536000, immutable')
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('decodes percent-encoded keys before looking them up', async () => {
    const { handler, requested } = handlerWith({ 'chassis/iron mongrel.png': 'bytes' })
    const res = await handler(get('/chassis/iron%20mongrel.png'))

    expect(res.status).toBe(200)
    expect(requested).toEqual(['chassis/iron mongrel.png'])
  })

  it('404s when the key is absent from the store', async () => {
    const { handler, requested } = handlerWith()
    const res = await handler(get('/chassis/nope.png'))

    expect(res.status).toBe(404)
    expect(await res.text()).toBe('Not found')
    expect(requested).toEqual(['chassis/nope.png'])
  })
})
