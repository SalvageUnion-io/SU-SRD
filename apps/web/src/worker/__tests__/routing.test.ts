import { describe, expect, it } from 'bun:test'
import type { Env } from '../index'
import worker from '../index'

/**
 * The one Worker, which Static Assets runs only for a miss
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

describe('a page under the pre-N4 `/schema/…/item/` grammar 301s to its new address', () => {
  const moves: Array<[from: string, to: string]> = [
    ['/schema/chassis/item/mule/', '/chassis/mule/'],
    ['/schema/chassis/item/mule', '/chassis/mule/'],
    ['/schema/chassis/item/mule/pattern/hauler/', '/chassis/mule/pattern/hauler/'],
    ['/schema/chassis/item/mule.og.png', '/chassis/mule.og.png'],
    ['/schema/chassis/', '/chassis/'],
    ['/schema/chassis', '/chassis/'],
    ['/schema/chassis/?view=list', '/chassis/?view=list'],
  ]
  for (const [from, to] of moves) {
    it(`${from} → ${to}`, async () => {
      const env = envWith()
      const res = await worker.fetch(req(from), env)

      expect(res.status).toBe(301)
      expect(res.headers.get('location')).toBe(to)
      // Decided without the binding: the old grammar is a pattern, not a file.
      expect(env.ASSETS.asked).toEqual([])
    })
  }
})

describe('any other miss is the 404 page, uncacheable', () => {
  for (const path of [
    '/nope-does-not-exist/',
    '/schema/',
    '/schema/chassis/item/',
    // The JSON API kept the old grammar: a missing row is a 404, never a page.
    '/schema/chassis/item/nope.json',
    '/schema/nope.json',
    '/favicons/missing.png',
  ]) {
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

describe('POST /__errors — a browser error report, logged for Workers Issues', () => {
  it('logs the report and answers 204, without touching the binding', async () => {
    const env = envWith()
    const logged: unknown[][] = []
    const realConsoleError = console.error
    console.error = (...args: unknown[]) => {
      logged.push(args)
    }
    try {
      const res = await worker.fetch(
        new Request('https://salvageunion.io/__errors', {
          method: 'POST',
          body: JSON.stringify({ name: 'TypeError', message: 'x is undefined' }),
        }),
        env
      )
      expect(res.status).toBe(204)
    } finally {
      console.error = realConsoleError
    }
    expect((logged[0]?.[0] as Error | undefined)?.message).toBe('x is undefined')
    expect(logged[0]?.[1]).toMatchObject({ source: 'browser', app: 'web' })
    expect(env.ASSETS.asked).toEqual([])
  })

  it('answers a GET 405, so a crawler never gets a page there', async () => {
    expect((await worker.fetch(req('/__errors'), envWith())).status).toBe(405)
  })
})

describe("POST /__convex-logs — Convex's log stream", () => {
  // `/build/__convex-logs` is where the stream posted before the app was one.
  for (const path of ['/__convex-logs', '/build/__convex-logs']) {
    it(`answers ${path} 503 while the stream secret is unset`, async () => {
      const res = await worker.fetch(
        new Request(`https://salvageunion.io${path}`, { method: 'POST', body: '[]' }),
        envWith()
      )
      expect(res.status).toBe(503)
    })

    it(`refuses an unsigned delivery to ${path} once the secret is set`, async () => {
      const env = { ...envWith(), CONVEX_LOG_STREAM_SECRET: 'whsec' }
      const res = await worker.fetch(
        new Request(`https://salvageunion.io${path}`, { method: 'POST', body: '[]' }),
        env
      )
      expect(res.status).toBe(401)
      expect(env.ASSETS.asked).toEqual([])
    })
  }
})

describe('a miss under the Dataset API is a JSON 404, not the page', () => {
  for (const path of ['/api/v1', '/api/v1/', '/api/v1/chassis/no-such-mech.json']) {
    it(path, async () => {
      const env = envWith()
      const res = await worker.fetch(req(path), env)

      expect(res.status).toBe(404)
      expect(res.headers.get('cache-control')).toBe('no-store')
      expect(res.headers.get('content-type')).toBe('application/json')
      expect(res.headers.get('access-control-allow-origin')).toBe('*')
      const body = await res.json()
      expect(body).toMatchObject({
        error: 'not_found',
        path,
        index: 'https://salvageunion.io/api/v1/index.json',
      })
      expect(env.ASSETS.asked).toEqual([])
    })
  }

  it('leaves a path that only starts like the tree alone', async () => {
    const env = envWith()
    const res = await worker.fetch(req('/api/v1x'), env)
    expect(res.headers.get('content-type')).not.toBe('application/json')
  })
})
