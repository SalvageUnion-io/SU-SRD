import { afterAll, afterEach, describe, expect, it, spyOn } from 'bun:test'
import * as observability from 'observability/cloudflare'
import type { AssetBucket } from '../worker'
import { makeAssetHandler } from '../worker'

/**
 * The R2 asset Worker's contract: its guards, its extension allowlist and its
 * reporting policy, each asserted case by case, so a guard going missing fails
 * here rather than in production.
 *
 * "Cannot open the store" is expressed as the bucket getter throwing.
 */

// Recorded, not sent: the handler imports `reportError` directly, so the test
// swaps that one export. Test files share a process: restore it after.
const reportError = spyOn(observability, 'reportError').mockImplementation(() => undefined)

afterEach(() => {
  reportError.mockClear()
})

afterAll(() => {
  reportError.mockRestore()
})

function bucketWith(entries: Record<string, string>): AssetBucket & { asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    async get(key: string) {
      asked.push(key)
      const body = entries[key]
      if (body === undefined) return null
      return { body: new Response(body).body }
    },
  }
}

function get(path: string): Request {
  return new Request(`https://assets.salvageunion.io${path}`)
}

describe('asset worker — request guards', () => {
  for (const [label, path] of [
    ['an empty key', '/'],
    ['a dotfile', '/.env'],
  ] as const) {
    it(`404s on ${label} without touching the store`, async () => {
      const bucket = bucketWith({})
      const res = await makeAssetHandler(() => bucket)(get(path))

      expect(res.status).toBe(404)
      expect(bucket.asked).toEqual([])
    })
  }

  it('rejects a traversal whose SLASH is encoded, before the extension allowlist', async () => {
    // `..%2f..%2f` is the shape that survives URL parsing: the separator is
    // encoded, so `new URL()` sees one opaque segment and cannot collapse it.
    // `decodeURIComponent` then reveals `../../`, and the guard fires. Decoding
    // BEFORE the guard is what makes the guard meaningful.
    const bucket = bucketWith({})
    const res = await makeAssetHandler(() => bucket)(get('/a/..%2f..%2fb.webp'))

    expect(res.status).toBe(404)
    expect(await res.text()).toBe('Not found')
    expect(bucket.asked).toEqual([])
  })

  it('normalises a literal or %2e-encoded traversal away before the handler sees it', async () => {
    // Not a guard case, and asserting it as one is a mistake this suite made on
    // the first attempt. `new URL()` resolves dot segments — including `%2e%2e`,
    // which it decodes during normalisation — so `/chassis/../mule.webp` and
    // `/chassis/%2e%2e/mule.webp` both arrive as `/mule.webp`.
    //
    // Nothing escapes: R2 keys are flat strings, so the result is an ordinary
    // lookup for a different in-bucket key, which 404s when absent. What must
    // hold is that the store is never asked for something outside its own
    // namespace — and a normalised key never is.
    for (const path of ['/chassis/../mule.webp', '/chassis/%2e%2e/mule.webp']) {
      const bucket = bucketWith({})
      const res = await makeAssetHandler(() => bucket)(get(path))

      expect(res.status).toBe(404)
      expect(bucket.asked).toEqual(['mule.webp'])
    }
  })

  for (const path of ['/chassis/mule.txt', '/chassis/mule', '/chassis/mule.js']) {
    it(`404s on an unlisted extension: ${path}`, async () => {
      const bucket = bucketWith({})
      const res = await makeAssetHandler(() => bucket)(get(path))

      expect(res.status).toBe(404)
      expect(bucket.asked).toEqual([])
    })
  }

  it('refuses a non-GET method', async () => {
    const bucket = bucketWith({ 'chassis/mule.webp': 'bytes' })
    const res = await makeAssetHandler(() => bucket)(
      new Request('https://assets.salvageunion.io/chassis/mule.webp', { method: 'POST' })
    )

    expect(res.status).toBe(405)
    expect(bucket.asked).toEqual([])
  })

  it('accepts every allowlisted extension, case-insensitively', async () => {
    for (const ext of ['png', 'PNG', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'svg']) {
      const key = `chassis/mule.${ext}`
      const bucket = bucketWith({ [key]: 'bytes' })
      const res = await makeAssetHandler(() => bucket)(get(`/${key}`))

      expect(res.status).toBe(200)
    }
  })
})

describe('asset worker — serving', () => {
  it('streams a stored object with immutable cache headers and CORS', async () => {
    const bucket = bucketWith({ 'chassis/mule.webp': 'imagebytes' })
    const res = await makeAssetHandler(() => bucket)(get('/chassis/mule.webp'))

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/webp')
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    // Required, not decorative: this host is addressed cross-origin from both
    // salvageunion.io and intheunionnow.com.
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(await res.text()).toBe('imagebytes')
  })

  it('sends the same security headers as the other two sites (#778)', async () => {
    const bucket = bucketWith({ 'chassis/mule.webp': 'bytes' })
    const res = await makeAssetHandler(() => bucket)(get('/chassis/mule.webp'))

    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(res.headers.get('strict-transport-security')).toContain('max-age=63072000')
    // PRESENT, and this assertion is inverted from what it used to be. It read
    // `toBeNull()` on the reasoning that "this origin serves bytes, never HTML
    // or script, so a CSP would govern nothing" — which is false for `svg`,
    // which the extension allowlist admits and which executes script when
    // fetched by direct navigation.
    expect(res.headers.get('content-security-policy')).toBe("default-src 'none'; sandbox")
  })

  it('decodes percent-encoded keys before looking them up', async () => {
    const bucket = bucketWith({ 'chassis/iron mongrel.webp': 'bytes' })
    const res = await makeAssetHandler(() => bucket)(get('/chassis/iron%20mongrel.webp'))

    expect(res.status).toBe(200)
    expect(bucket.asked).toEqual(['chassis/iron mongrel.webp'])
  })

  it('404s when the key is absent', async () => {
    const bucket = bucketWith({})
    const res = await makeAssetHandler(() => bucket)(get('/chassis/nope.webp'))

    expect(res.status).toBe(404)
    expect(bucket.asked).toEqual(['chassis/nope.webp'])
  })

  it('marks every error no-store, so Workers Caching never keeps one', async () => {
    // A cached 404 would hide a newly uploaded image for as long as it lived.
    const down: AssetBucket = {
      async get() {
        throw new Error('r2 down')
      },
    }
    const responses = [
      await makeAssetHandler(() => bucketWith({}))(get('/chassis/nope.webp')),
      await makeAssetHandler(() => bucketWith({}))(get('/chassis/mule.txt')),
      await makeAssetHandler(() => bucketWith({}))(
        new Request('https://assets.salvageunion.io/chassis/mule.webp', { method: 'POST' })
      ),
      await makeAssetHandler(() => down)(get('/chassis/mule.webp')),
    ]

    expect(responses.map((r) => r.status)).toEqual([404, 404, 405, 503])
    for (const res of responses) expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('404s when the object exists but carries no body', async () => {
    const bucket: AssetBucket = {
      async get() {
        return { body: null }
      },
    }
    const res = await makeAssetHandler(() => bucket)(get('/chassis/mule.webp'))

    expect(res.status).toBe(404)
  })
})

describe('asset worker — reporting policy', () => {
  it('reports a failing read as a 503, with the key as context', async () => {
    const bucket: AssetBucket = {
      async get() {
        throw new Error('r2 down')
      },
    }
    const res = await makeAssetHandler(() => bucket)(get('/chassis/mule.webp'))

    expect(res.status).toBe(503)
    expect(reportError).toHaveBeenCalledTimes(1)
    expect(reportError.mock.calls[0]?.[1]).toEqual({
      fn: 'asset',
      op: 'r2.get',
      key: 'chassis/mule.webp',
    })
  })

  it('reports a bucket that cannot even be opened', async () => {
    const res = await makeAssetHandler(() => {
      throw new Error('no binding')
    })(get('/chassis/mule.webp'))

    expect(res.status).toBe(503)
    expect(reportError).toHaveBeenCalledTimes(1)
  })

  for (const [label, path] of [
    ['a missing key', '/chassis/nope.webp'],
    ['a traversal attempt', '/chassis/../secret.webp'],
    ['an unsupported extension', '/chassis/mule.txt'],
  ] as const) {
    it(`reports nothing for ${label}`, async () => {
      // This Worker answers every path on a public, crawler-visible host.
      // Alerting on these would turn the Sentry project into a scanner log.
      const bucket = bucketWith({})
      await makeAssetHandler(() => bucket)(get(path))

      expect(reportError).not.toHaveBeenCalled()
    })
  }
})
