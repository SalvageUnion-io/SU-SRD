import { describe, expect, it } from 'bun:test'
import type { Env } from '../index'
import worker from '../index'

/**
 * The srd Worker, which Static Assets runs only for a miss
 * (`not_found_handling: "none"` — see `../index.ts`).
 *
 * The rule production broke: a miss under `/assets/` must never be cacheable.
 * Served by `404-page` handling, it took `_headers`' `/assets/*` rule and was
 * `immutable` for a year, so a chunk asked for mid-deploy stayed missing.
 */

const PAGE = '<!doctype html><title>404 - Page Not Found</title>'

/** A fake asset binding holding `files`; records every path it is asked for. */
function assetsWith(files: Record<string, string>) {
  const asked: string[] = []
  return {
    asked,
    async fetch(request: Request): Promise<Response> {
      const path = new URL(request.url).pathname
      asked.push(path)
      const body = files[path]
      if (body === undefined) return new Response(null, { status: 404 })
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'content-security-policy': "default-src 'self'",
          'cache-control': 'public, max-age=0, must-revalidate',
        },
      })
    },
  }
}

function envWith(files: Record<string, string> = { '/404': PAGE }) {
  return { ASSETS: assetsWith(files) } as Env & { ASSETS: ReturnType<typeof assetsWith> }
}

const req = (path: string) => new Request(`https://salvageunion.io${path}`)

describe('/assets/* — a miss is a bare, uncacheable 404', () => {
  it('answers a rotated-away chunk 404 with no-store', async () => {
    const env = envWith()
    const res = await worker.fetch(req('/assets/index-DEADBEEF.js'), env)

    expect(res.status).toBe(404)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.text()).not.toContain('<!doctype html>')
    // Decided without the binding: there is nothing it could add.
    expect(env.ASSETS.asked).toEqual([])
  })
})

describe('any other miss is the 404 page, uncacheable', () => {
  for (const path of ['/nope-does-not-exist/', '/schema/nope/', '/favicons/missing.png']) {
    it(`serves 404.html for ${path}`, async () => {
      const env = envWith()
      const res = await worker.fetch(req(path), env)

      expect(res.status).toBe(404)
      expect(await res.text()).toBe(PAGE)
      expect(res.headers.get('cache-control')).toBe('no-store')
      // The binding applied `_headers`; the page keeps them.
      expect(res.headers.get('content-security-policy')).toBe("default-src 'self'")
      // `/404`, not `/404.html`, which the asset server's HTML handling redirects.
      expect(env.ASSETS.asked).toEqual(['/404'])
    })
  }

  it('falls back to a bare 404 when the page itself is missing', async () => {
    const res = await worker.fetch(req('/nope/'), envWith({}))

    expect(res.status).toBe(404)
    expect(res.headers.get('cache-control')).toBe('no-store')
  })
})
