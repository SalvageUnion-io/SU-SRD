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

/**
 * Rule 6. Before it, the shell answered `200 text/html` for EVERY path that was
 * not a real file — so `/robots.txt` handed a crawler a web page where it had
 * asked for crawl rules, `/favicon.ico` returned a document, and every typo was
 * an indexable soft-404. Measured against production before the fix: those
 * three plus `/sitemap.xml` all returned `200 text/html`.
 *
 * The discriminator is a dot in the last path segment. A client route in this
 * app never has one; a request for a file always does.
 */
describe('a missing FILE is 404, not the shell', () => {
  for (const path of [
    '/favicon.ico',
    '/sitemap.xml',
    '/robots.txt',
    '/apple-touch-icon.png',
    '/manifest.json',
    '/deep/path/thing.txt',
  ]) {
    it(`404s ${path} when it is not a real file`, async () => {
      const env = envWith({ '/index.html': '<!doctype html>SPA' })
      const res = await worker.fetch(req(path), env)

      expect(res.status).toBe(404)
      expect(await res.text()).not.toContain('SPA')
    })
  }

  it('still serves such a path when it IS a real file', async () => {
    const env = envWith({ '/index.html': 'SPA', '/favicon.ico': 'ICO' })
    const res = await worker.fetch(req('/favicon.ico'), env)

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ICO')
  })

  it('does not touch dotless client routes', async () => {
    // The regression this rule must not cause: a real client route that happens
    // to look unusual is still the SPA, because it has no extension.
    const env = envWith({ '/index.html': '<!doctype html>SPA' })
    for (const path of ['/games/abc123', '/sheet/pilot/xyz', '/p/mech/v1.2']) {
      const res = await worker.fetch(req(path), env)
      // `/p/mech/v1.2` is the deliberate edge: a dot in the LAST segment reads
      // as a file, so it 404s. Recorded rather than hidden — if a route ever
      // needs a dot in its final segment, this rule is what to revisit.
      const expected = path.slice(path.lastIndexOf('/') + 1).includes('.') ? 404 : 200
      expect(res.status, `${path} should be ${expected}`).toBe(expected)
    }
  })
})

/**
 * The wiring, not just the helper. `shellMeta.test.ts` covers the rendering;
 * this covers that a real `/s/:id` request reaches it and that failure degrades
 * to the defaults rather than to a 500.
 */
describe('shared snapshots unfurl with their own metadata', () => {
  const SHELL = [
    '<!doctype html><html><head><title>In The Union Now</title>',
    '<!-- itun:meta:start -->',
    '<meta property="og:title" content="In The Union Now" />',
    '<!-- itun:meta:end -->',
    '</head><body></body></html>',
  ].join('\n')

  it('injects the sheet name for a snapshot that exists', async () => {
    const env = envWith(
      { '/index.html': SHELL },
      { AAAAAAAA: { kind: 'pilot', entity: { name: 'Rusty' } } }
    )
    const res = await worker.fetch(req('/s/AAAAAAAA'), env)
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('Rusty — Pilot')
    expect(body.match(/property="og:title"/g)).toHaveLength(1)
  })

  it('drops a stale Content-Length rather than truncating the document', async () => {
    // The injected block changes the body length; keeping the asset response's
    // header would cut the document off mid-tag.
    const env = envWith(
      { '/index.html': SHELL },
      { AAAAAAAA: { kind: 'pilot', entity: { name: 'Rusty' } } }
    )
    const res = await worker.fetch(req('/s/AAAAAAAA'), env)
    expect(res.headers.get('content-length')).toBeNull()
    expect(await res.text()).toContain('</html>')
  })

  it('serves the default shell when the snapshot is missing', async () => {
    const env = envWith({ '/index.html': SHELL }, {})
    const res = await worker.fetch(req('/s/AAAAAAAA'), env)

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('In The Union Now')
  })

  it('leaves every other client route on the defaults', async () => {
    const env = envWith({ '/index.html': SHELL }, {})
    const res = await worker.fetch(req('/roster'), env)
    expect(await res.text()).toContain('content="In The Union Now"')
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

  it('POST {} → 400 and stores nothing — the Worker runs the STRICT check', async () => {
    // The gap this whole change exists to close, asserted on the host that
    // actually serves publishes. Before validation this answered 201 with a
    // real share URL for a snapshot `/s/$id` could never render — verified
    // against production before the fix.
    const env = envWith()
    const res = await worker.fetch(
      req('/api/snapshots', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      env
    )

    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Entity data is missing')
    expect(env.SNAPSHOTS._store.size).toBe(0)
  })

  it('POST a known kind with an unrenderable entity → 400', async () => {
    const env = envWith()
    const res = await worker.fetch(
      req('/api/snapshots', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'pilot', entity: { nonsense: true } }),
      }),
      env
    )

    expect(res.status).toBe(400)
    expect(env.SNAPSHOTS._store.size).toBe(0)
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
    // Deliberate tolerance, and NOT evidence that an absent binding is fine:
    // the 256 KB cap bounds bytes per request, not requests, so it does not
    // bound storage amplification at all. This asserts the Worker still SERVES
    // without the binding; that the binding is actually declared is asserted by
    // `rateLimitBinding.test.ts`, which reads wrangler.jsonc.
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

/**
 * `/og/s/:id.png` — the rendered unfurl image.
 *
 * **What can be asserted here is the routing, not the render.** The handler
 * reaches `renderOgImage` through a lazy `await import('./ogImage')`, and that
 * module imports two TTFs and a 2.4 MB `.wasm` via wrangler's module rules —
 * under `bun test` those imports throw, the handler's catch turns that into the
 * static fallback, and a valid snapshot is therefore indistinguishable from a
 * missing one. So the success path is deliberately not asserted; it was
 * verified against `wrangler dev`, which is the only runtime that can load it.
 * The card's own layout is covered in `ogCard.test.ts`.
 *
 * What IS worth pinning down is everything around it, because each part has a
 * way of silently going wrong:
 *
 *   - the route must be matched BEFORE the asset lookup. `/og/s/X.png` ends in
 *     a dot-bearing segment, which is exactly what rule 6 turns into a 404.
 *   - every failure must end at an image, never at an error. A 404 or a 500
 *     here makes the link look broken in the channel it was pasted into, which
 *     is worse than a generic picture.
 */
describe('/og/s/:id.png', () => {
  it('is matched before the asset lookup, despite ending in .png', async () => {
    // Rule 6 404s any path whose last segment contains a dot. If this route
    // were dispatched after it, every unfurl would be a 404 and the reason
    // would look like a CDN problem.
    const env = envWith({ '/index.html': 'SPA' }, {})
    const res = await worker.fetch(req('/og/s/AAAAAAAA.png'), env)

    expect(res.status).not.toBe(404)
    expect(env.ASSETS.asked).not.toContain('/og/s/AAAAAAAA.png')
  })

  it('falls back to the static icon for a malformed id', async () => {
    const env = envWith({ '/index.html': 'SPA' }, {})
    const res = await worker.fetch(req('/og/s/not a valid id!.png'), env)

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://intheunionnow.com/icon-512.png')
  })

  it('falls back to the static icon when the snapshot is gone', async () => {
    // A revoked snapshot is the common case, not an exotic one: the id is the
    // whole capability, and revoking it is how sharing is undone.
    const env = envWith({ '/index.html': 'SPA' }, {})
    const res = await worker.fetch(req('/og/s/AAAAAAAA.png'), env)

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://intheunionnow.com/icon-512.png')
  })

  it('never answers an unfurl with an error status', async () => {
    const env = envWith({ '/index.html': 'SPA' }, {})
    for (const path of ['/og/s/AAAAAAAA.png', '/og/s/!!.png', '/og/s/A.png']) {
      const res = await worker.fetch(req(path), env)
      expect(res.status).toBeLessThan(400)
    }
  })

  // ---------------------------------------------------------------------
  // Security headers
  //
  // Cloudflare does not apply `public/_headers` to responses Worker code
  // GENERATES, and `wrangler.jsonc` sets `run_worker_first`, so every exit
  // path below used to ship with no CSP, no HSTS and no nosniff. These assert
  // the wrapper covers the paths a request can actually leave by — including
  // the redirect, which is the one that cannot have its headers mutated in
  // place and so is the likeliest to be missed by a per-return fix.
  // ---------------------------------------------------------------------

  it.each([
    ['a redirect', '/share/pilot/AAAAAAAA'],
    ['a 400 on a malformed snapshot id', '/api/snapshots/!!!'],
    ['an og:image fallback', '/og/s/!!.png'],
    ['the SPA shell', '/pilots/whatever'],
    ['a 404 for a missing file', '/nope.txt'],
  ])('sets the security headers on %s', async (_label, path) => {
    const env = envWith({ '/index.html': 'SPA' }, {})
    const res = await worker.fetch(req(path), env)

    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'")
    expect(res.headers.get('strict-transport-security')).toContain('max-age=63072000')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('keeps the CSP in lockstep with public/_headers', async () => {
    // Two sources for one policy is a drift hazard, so it is asserted rather
    // than trusted. tools/check-observability.ts holds the Sentry ingest origin
    // to the same value in both; this holds the whole directive list.
    const headersFile = await Bun.file(new URL('../../../public/_headers', import.meta.url)).text()
    const declared = headersFile
      .split('\n')
      .find((line) => line.trim().startsWith('Content-Security-Policy:'))
    expect(declared).toBeDefined()

    const env = envWith({ '/index.html': 'SPA' }, {})
    const served = (await worker.fetch(req('/pilots/x'), env)).headers.get(
      'content-security-policy'
    )

    const normalise = (value: string) => value.replace(/\s+/g, ' ').trim().replace(/;$/, '')
    expect(normalise(served ?? '')).toBe(
      normalise((declared as string).replace('Content-Security-Policy:', ''))
    )
  })

  it('points the shell metadata at this route for a snapshot that exists', async () => {
    // The two halves have to agree: a card nobody links to is not an unfurl.
    const SHELL = [
      '<!doctype html><html><head>',
      '<!-- itun:meta:start -->',
      '<meta property="og:title" content="In The Union Now" />',
      '<!-- itun:meta:end -->',
      '</head><body></body></html>',
    ].join('\n')
    const env = envWith(
      { '/index.html': SHELL },
      { AAAAAAAA: { kind: 'pilot', entity: { name: 'Rusty' } } }
    )
    const body = await (await worker.fetch(req('/s/AAAAAAAA'), env)).text()

    expect(body).toContain('content="https://intheunionnow.com/og/s/AAAAAAAA.png"')
  })
})
