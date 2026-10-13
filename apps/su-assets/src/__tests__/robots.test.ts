import { describe, expect, it } from 'bun:test'
import type { AssetBucket } from '../worker'
import { makeAssetHandler } from '../worker'
import { emptyBucket, req } from './fixtures'

/**
 * `/robots.txt`.
 *
 * This origin holds artwork licensed from Leyline Press under "do not
 * redistribute", so it must disallow every crawler. The Worker has no assets
 * directory, so without its own branch this path falls through to Cloudflare's
 * zone-level managed robots.txt — content-signal comments with **no `Disallow` directive at all**,
 * which permits everything.
 */

describe('su-assets robots.txt', () => {
  it('disallows every crawler', async () => {
    const res = await makeAssetHandler(() => emptyBucket)(req('/robots.txt'))

    expect(res.status).toBe(200)
    const body = await res.text()
    expect(body).toContain('User-agent: *')
    expect(body).toContain('Disallow: /')
  })

  it('is text/plain, not an image content type', async () => {
    const res = await makeAssetHandler(() => emptyBucket)(req('/robots.txt'))
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8')
  })

  it('carries the shared security headers', async () => {
    // It is a real response from this origin, not a special case that skips the
    // policy every other response here carries.
    const res = await makeAssetHandler(() => emptyBucket)(req('/robots.txt'))
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('strict-transport-security')).toContain('max-age=')
  })

  it('is NOT cached for a year', async () => {
    // Artwork is immutable; a crawl directive is policy. A year-long immutable
    // cache on it would make any future change take a year to be believed.
    const res = await makeAssetHandler(() => emptyBucket)(req('/robots.txt'))
    expect(res.headers.get('cache-control')).not.toContain('immutable')
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600')
  })

  it('is served without touching the bucket', async () => {
    let reads = 0
    const counting: AssetBucket = {
      async get() {
        reads += 1
        return null
      },
    }
    await makeAssetHandler(() => counting)(req('/robots.txt'))
    expect(reads).toBe(0)
  })

  it('still refuses a non-GET', async () => {
    // The method guard runs first and must keep applying to this path too.
    const res = await makeAssetHandler(() => emptyBucket)(req('/robots.txt', 'POST'))
    expect(res.status).toBe(405)
  })

  it('does not swallow a real asset whose name merely contains robots.txt', async () => {
    // The match is on the exact pathname, not a substring.
    const bucket: AssetBucket = {
      async get(key: string) {
        return key === 'chassis/robots.txt.webp' ? { body: new Response('art').body } : null
      },
    }
    const res = await makeAssetHandler(() => bucket)(req('/chassis/robots.txt.webp'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('art')
  })
})
