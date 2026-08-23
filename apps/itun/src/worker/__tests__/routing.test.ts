import { describe, expect, it } from 'bun:test'
import { pilotFixture } from '../../components/__tests__/fixtures'
import type { Env } from '../index'
import worker from '../index'

/**
 * A body publish will actually accept. These tests posted `{ kind: 'pilot',
 * name: 'Mule' }` before publish validated its payload — a shape `/s/$id` could
 * never have rendered. See `lib/snapshot/payload.ts`.
 */
const PUBLISHABLE = { kind: 'pilot', entity: pilotFixture({ id: 'p-worker' }) }

/**
 * The itun Worker's routing table (ADR-033 P4).
 *
 * `netlify.toml` expressed this as an ordered redirect list. Cloudflare cannot
 * express method-conditioned routing declaratively, so it became code — which
 * is more legible and less verified. These tests are the compensation: every
 * rule that used to be config, and every ordering constraint whose comment
 * cites an incident, is asserted here.
 *
 * The two that have already broken production:
 *
 *   - `/assets/*` on a miss must be **404**, never the SPA shell. Answering 200
 *     with HTML let the `immutable` header pin that HTML into the HTTP cache for
 *     a year under a rotated chunk's URL (#759).
 *   - DELETE `/api/snapshots/:id` must be matched BEFORE the unconditioned
 *     retrieve, or revocation answers 405.
 */

/** A fake static-asset binding: `not_found_handling: "none"` semantics. */
function assetsWith(files: Record<string, string>) {
  const asked: string[] = []
  return {
    asked,
    async fetch(request: Request): Promise<Response> {
      const path = new URL(request.url).pathname
      asked.push(path)
      const body = files[path]
      if (body === undefined) return new Response('not found', { status: 404 })
      return new Response(body, { status: 200, headers: { 'content-type': 'text/html' } })
    },
  }
}

/** A fake R2 bucket, matching the `R2BucketLike` seam. */
function bucketWith(objects: Record<string, unknown>) {
  const store = new Map(Object.entries(objects).map(([k, v]) => [k, JSON.stringify(v)]))
  return {
    async get(key: string) {
      const body = store.get(key)
      if (body === undefined) return null
      return { json: async <T>(): Promise<T> => JSON.parse(body) as T }
    },
    async put(key: string, value: string) {
      store.set(key, value)
      return undefined
    },
    async delete(key: string) {
      store.delete(key)
    },
    _store: store,
  }
}

function envWith(
  files: Record<string, string> = { '/index.html': '<!doctype html>SPA' },
  objects: Record<string, unknown> = {}
): Env & { ASSETS: ReturnType<typeof assetsWith>; SNAPSHOTS: ReturnType<typeof bucketWith> } {
  return {
    ASSETS: assetsWith(files),
    SNAPSHOTS: bucketWith(objects),
  } as never
}

const req = (path: string, init?: RequestInit) =>
  new Request(`https://intheunionnow.com${path}`, init)

describe('retired share URL', () => {
  it('301s /sheet/:kind/:id/share to the sheet', async () => {
    const env = envWith()
    const res = await worker.fetch(req('/sheet/pilot/abc123/share'), env)

    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://intheunionnow.com/sheet/pilot/abc123')
  })

  it('301 rather than 302 — the screen is not coming back (#793)', async () => {
    const env = envWith()
    const res = await worker.fetch(req('/sheet/mech/xyz/share'), env)

    expect(res.status).toBe(301)
    expect(res.status).not.toBe(302)
  })

  it('leaves the sheet route itself alone', async () => {
    const env = envWith()
    const res = await worker.fetch(req('/sheet/pilot/abc123'), env)

    // A client-side route: the shell, 200 — not a redirect loop.
    expect(res.status).toBe(200)
  })
})

describe('/assets/* — a miss must 404, never the shell', () => {
  it('serves a real hashed chunk', async () => {
    const env = envWith({
      '/index.html': 'SPA',
      '/assets/index-C9pQFcVN.js': 'console.log(1)',
    })
    const res = await worker.fetch(req('/assets/index-C9pQFcVN.js'), env)

    expect(res.status).toBe(200)
  })

  it('404s a rotated-away chunk instead of returning the SPA shell', async () => {
    // The whole point. A 200 here let the `immutable` header pin an HTML
    // document into the HTTP cache for a year under a chunk URL (#759), and the
    // import rejected on MIME type rather than recovering.
    const env = envWith({ '/index.html': 'SPA' })
    const res = await worker.fetch(req('/assets/index-DEADBEEF.js'), env)

    expect(res.status).toBe(404)
    expect(await res.text()).not.toContain('SPA')
  })
})

describe('SPA fallback', () => {
  for (const path of ['/', '/s/AAAAAAAA', '/p/pilot/abc', '/roster', '/deep/unknown/route']) {
    it(`serves the shell with 200 for ${path}`, async () => {
      const env = envWith({ '/index.html': '<!doctype html>SPA' })
      const res = await worker.fetch(req(path), env)

      expect(res.status).toBe(200)
      expect(await res.text()).toContain('SPA')
    })
  }

  it('prefers a real file over the shell', async () => {
    const env = envWith({ '/index.html': 'SPA', '/robots.txt': 'User-agent: *' })
    const res = await worker.fetch(req('/robots.txt'), env)

    expect(await res.text()).toBe('User-agent: *')
  })
})

describe('/api/snapshots — method-conditioned routing', () => {
  it('POST publishes and returns an id', async () => {
    const env = envWith()
    const res = await worker.fetch(
      req('/api/snapshots', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(PUBLISHABLE),
      }),
      env
    )

    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: string; url: string }
    expect(body.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/)
    expect(body.url).toBe(`/api/snapshots/${body.id}`)
  })

  for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) {
    it(`${method} /api/snapshots is 405`, async () => {
      const env = envWith()
      const res = await worker.fetch(req('/api/snapshots', { method }), env)

      expect(res.status).toBe(405)
    })
  }

  it('GET /api/snapshots/:id retrieves the payload', async () => {
    const env = envWith({ '/index.html': 'SPA' }, { ABCD1234: { kind: 'pilot' } })
    const res = await worker.fetch(req('/api/snapshots/ABCD1234'), env)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ kind: 'pilot' })
  })

  it('DELETE /api/snapshots/:id revokes — it is NOT swallowed into a 405', async () => {
    // The ordering constraint netlify.toml's comment warns about: the retrieve
    // rule has no method condition, so a DELETE matched against it answers 405
    // and revocation silently stops working.
    const env = envWith({ '/index.html': 'SPA' }, { ABCD1234: { kind: 'pilot' } })
    const res = await worker.fetch(req('/api/snapshots/ABCD1234', { method: 'DELETE' }), env)

    expect(res.status).not.toBe(405)
    expect(res.status).toBeLessThan(300)
    expect(await env.SNAPSHOTS.get('ABCD1234')).toBeNull()
  })

  it('404s an unknown id', async () => {
    const env = envWith()
    const res = await worker.fetch(req('/api/snapshots/ZZZZZZZZ'), env)

    expect(res.status).toBe(404)
  })

  it('400s a malformed id without touching storage', async () => {
    const env = envWith()
    const res = await worker.fetch(req('/api/snapshots/not-a-valid-id'), env)

    expect(res.status).toBe(400)
  })
})

describe('rate limiting', () => {
  it('429s a POST the binding rejects', async () => {
    const env = {
      ...envWith(),
      RATE_LIMITER: {
        async limit() {
          return { success: false }
        },
      },
    }
    const res = await worker.fetch(
      req('/api/snapshots', { method: 'POST', body: '{}' }),
      env as never
    )

    expect(res.status).toBe(429)
  })

  it('is optional — an absent binding means no limiting, not a crash', async () => {
    // Deliberate: the enforced 256 KB payload cap does the storage-amplification
    // work, so a Worker with no binding provisioned must still serve.
    const env = envWith()
    expect(env.RATE_LIMITER).toBeUndefined()
    const res = await worker.fetch(
      req('/api/snapshots', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(PUBLISHABLE),
      }),
      env
    )

    expect(res.status).toBe(201)
  })

  it('does not rate-limit reads', async () => {
    const env = {
      ...envWith({ '/index.html': 'SPA' }, { ABCD1234: { kind: 'pilot' } }),
      RATE_LIMITER: {
        async limit() {
          return { success: false }
        },
      },
    }
    const res = await worker.fetch(req('/api/snapshots/ABCD1234'), env as never)

    expect(res.status).toBe(200)
  })
})
