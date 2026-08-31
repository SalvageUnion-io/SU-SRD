import { describe, expect, it } from 'bun:test'
import type { AssetBucket, ImagesBinding } from '../worker'
import { makeAssetHandler } from '../worker'

/**
 * Cloudflare Images derivatives.
 *
 * The baked `-440`/`-880` objects `tools/generate-lp-asset-derivatives.ts` used
 * to write are now rendered on demand from the master. The public URL grammar is
 * deliberately unchanged, which is what lets the stored derivatives keep serving
 * until someone prunes them — so the first case below is migration safety, not a
 * leftover.
 *
 * Kept separate from `worker.test.ts` because that file states its purpose as
 * holding the port to the Netlify Function's contract, case for case. This
 * behaviour has no Netlify counterpart.
 */

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

type Stub = ImagesBinding & { calls: number[] }

function imagesStub(onTransform?: (width: number) => void): Stub {
  const calls: number[] = []
  return {
    calls,
    input(_stream: ReadableStream) {
      return {
        transform({ width }: { width: number }) {
          calls.push(width)
          onTransform?.(width)
          return {
            async output({ format }: { format: string }) {
              return { response: () => new Response(`rendered:${width}:${format}`) }
            },
          }
        },
      }
    },
  }
}

describe('asset worker — derivatives', () => {
  it('serves a STORED derivative without transforming', async () => {
    // Migration safety: the pre-baked objects keep working untouched, so this
    // change needs no coordinated bucket edit to be safe to deploy.
    const bucket = bucketWith({ 'chassis/mule-440.webp': 'baked' })
    const images = imagesStub()
    const res = await makeAssetHandler(
      () => bucket,
      () => {},
      images
    )(get('/chassis/mule-440.webp'))

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('baked')
    expect(images.calls).toEqual([])
  })

  it('renders a missing derivative from the master', async () => {
    const bucket = bucketWith({ 'chassis/mule.webp': 'master-bytes' })
    const images = imagesStub()
    const res = await makeAssetHandler(
      () => bucket,
      () => {},
      images
    )(get('/chassis/mule-880.webp'))

    expect(res.status).toBe(200)
    expect(images.calls).toEqual([880])
    expect(res.headers.get('content-type')).toBe('image/webp')
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(bucket.asked).toEqual(['chassis/mule-880.webp', 'chassis/mule.webp'])
  })

  it('404s an un-allowlisted width WITHOUT transforming', async () => {
    // The quota guard, and the reason the allowlist exists at all. Images bills
    // per unique transformation and the Free plan stops at 5,000/month. The
    // width arrives in a public URL on an unauthenticated origin, so a crawler
    // walking -1, -2, -3 would burn a month's quota in one pass, after which
    // every transformation on the whole ACCOUNT fails with 9422.
    const bucket = bucketWith({ 'chassis/mule.webp': 'master-bytes' })
    const images = imagesStub()

    for (const width of [1, 2, 439, 441, 1600, 99999]) {
      const res = await makeAssetHandler(
        () => bucket,
        () => {},
        images
      )(get(`/chassis/mule-${width}.webp`))
      expect(res.status).toBe(404)
    }
    expect(images.calls).toEqual([])
  })

  it('404s rather than crashing when the Images binding is absent', async () => {
    // Local dev, or before Transformations are enabled on the zone. A missing
    // derivative makes a browser fall back to the `src` master — correct output,
    // just larger — which is a far better failure than a 500.
    const bucket = bucketWith({ 'chassis/mule.webp': 'master-bytes' })
    const res = await makeAssetHandler(() => bucket)(get('/chassis/mule-440.webp'))

    expect(res.status).toBe(404)
  })

  it('404s when neither the derivative nor its master exists', async () => {
    const bucket = bucketWith({})
    const images = imagesStub()
    const res = await makeAssetHandler(
      () => bucket,
      () => {},
      images
    )(get('/chassis/ghost-440.webp'))

    expect(res.status).toBe(404)
    expect(images.calls).toEqual([])
  })

  it('REPORTS a transformation failure, unlike a 404', async () => {
    // A 404 is a scanner and is deliberately silent. A transform throwing means
    // the quota is exhausted, the zone is misconfigured, or the master will not
    // decode — all three break artwork silently and none is visible from outside.
    const bucket = bucketWith({ 'chassis/mule.webp': 'master-bytes' })
    const reported: Array<Record<string, unknown> | undefined> = []
    const exploding = imagesStub(() => {
      throw new Error('9422')
    })

    const res = await makeAssetHandler(
      () => bucket,
      (_e, ctx) => reported.push(ctx),
      exploding
    )(get('/chassis/mule-440.webp'))

    expect(res.status).toBe(404)
    expect(reported).toHaveLength(1)
    expect(reported[0]).toMatchObject({ op: 'images.transform', width: 440 })
  })

  it('does not treat a non-derivative miss as a transformation request', async () => {
    const bucket = bucketWith({})
    const images = imagesStub()
    const res = await makeAssetHandler(
      () => bucket,
      () => {},
      images
    )(get('/chassis/mule.webp'))

    expect(res.status).toBe(404)
    expect(images.calls).toEqual([])
    expect(bucket.asked).toEqual(['chassis/mule.webp'])
  })
})
