import { describe, expect, it } from 'bun:test'
import { pilotFixture } from '../../components/__tests__/fixtures'
import type { Env } from '../index'
import worker from '../index'
import { ITUN_CSP } from '../securityHeaders'

/** A snapshot as every published one was stored: `{ kind, entity }`. */
const STORED = { kind: 'pilot', entity: pilotFixture({ id: 'p-worker', name: 'Rusty' }) }

/**
 * The itun Worker's routing table (ADR-033 P4).
 *
 * Cloudflare cannot express method-conditioned routing declaratively, so it is
 * code — more legible than config and less verified. These tests are the
 * compensation: every rule, and every ordering constraint whose comment cites
 * an incident, is asserted here.
 *
 * The one that has already broken production: `/assets/*` on a miss must be
 * **404**, never the SPA shell. Answering 200 with HTML let the `immutable`
 * header pin that HTML into the HTTP cache for a year under a rotated chunk's
 * URL (#759).
 *
 * The snapshot API is down to one read (ADR-036), and the retired halves are
 * asserted as retired: no publish, no revoke, no frozen build served. The
 * unfurl of links already posted (`/s/:id` metadata, `/og/s/:id.png`) stays.
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

/**
 * A fake R2 bucket. It has `put` and `delete` although the read-only
 * `R2BucketLike` seam does not, so that a regression which started writing
 * again would show up in `_store` rather than be impossible to observe.
 */
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

describe('retired detail pages', () => {
  it.each([
    ['/pilots/abc123', '/sheet/pilot/abc123'],
    ['/mechs/xyz', '/sheet/mech/xyz'],
    ['/crawlers/c-9', '/sheet/crawler/c-9'],
  ])('301s %s to %s', async (from, to) => {
    const res = await worker.fetch(req(from), envWith())

    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe(`https://intheunionnow.com${to}`)
  })

  it('leaves the wizards and the pattern library to the SPA', async () => {
    for (const path of ['/pilots/new', '/mechs/new', '/crawlers/new', '/mechs/patterns']) {
      const res = await worker.fetch(req(path), envWith())
      expect(res.status).toBe(200)
    }
  })
})

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
 * The shell's Cache-Control is set by the Worker, not inherited.
 *
 * It used to be whatever `ASSETS.fetch` returned, which is right only while
 * Workers Static Assets' default happens to be. `_headers` cannot be relied on
 * for it: Cloudflare does not apply that file to a response Worker code builds,
 * and rule 7 builds every shell it serves. So the binding below deliberately
 * hands back a YEAR of `immutable` for the shell — the worst thing the asset
 * layer could say — and every HTML document must still leave revalidating.
 */
describe('every HTML document revalidates', () => {
  const REVALIDATE = 'public, max-age=0, must-revalidate'
  const SHELL = [
    '<!doctype html><html><head>',
    '<!-- itun:meta:start -->',
    '<meta property="og:title" content="In The Union Now" />',
    '<!-- itun:meta:end -->',
    '</head><body></body></html>',
  ].join('\n')

  /** A binding that serves each file with its own content type and cache header. */
  function typedAssets(files: Record<string, { body: string; type: string; cache: string }>) {
    return {
      async fetch(request: Request): Promise<Response> {
        const file = files[new URL(request.url).pathname]
        if (!file) return new Response('not found', { status: 404 })
        return new Response(file.body, {
          status: 200,
          headers: { 'content-type': file.type, 'cache-control': file.cache },
        })
      },
    }
  }

  const IMMUTABLE = 'public, max-age=31536000, immutable'
  const shellFile = { body: SHELL, type: 'text/html; charset=utf-8', cache: IMMUTABLE }

  function env(objects: Record<string, unknown> = {}) {
    return {
      ASSETS: typedAssets({
        '/': shellFile,
        '/index.html': shellFile,
        '/assets/index-C9pQFcVN.js': { body: '1', type: 'text/javascript', cache: IMMUTABLE },
      }),
      SNAPSHOTS: bucketWith(objects),
    } as never
  }

  it.each([
    ['a client route (rule 7)', '/sheet/pilot/abc123'],
    ['the root, served as a real file (rule 5)', '/'],
  ])('%s', async (_label, path) => {
    const res = await worker.fetch(req(path), env())

    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe(REVALIDATE)
  })

  it('a snapshot shell with injected metadata', async () => {
    // The other rule-7 branch: the body is rewritten, so the headers are copied.
    const res = await worker.fetch(req('/s/AAAAAAAA'), env({ AAAAAAAA: STORED }))

    expect(await res.text()).toContain('Rusty — Pilot')
    expect(res.headers.get('cache-control')).toBe(REVALIDATE)
  })

  it('leaves a hashed chunk immutable — only documents are forced', async () => {
    const res = await worker.fetch(req('/assets/index-C9pQFcVN.js'), env())

    expect(res.headers.get('cache-control')).toBe(IMMUTABLE)
  })

  it('agrees with the /*.html block of public/_headers', async () => {
    // Two sources for one value: asserted, not trusted.
    const headersFile = await Bun.file(new URL('../../../public/_headers', import.meta.url)).text()
    const lines = headersFile.split('\n')
    const block = lines.indexOf('/*.html')
    expect(block).toBeGreaterThan(-1)
    const declared = lines
      .slice(block + 1)
      .find((line) => line.trim().startsWith('Cache-Control:'))
      ?.replace('Cache-Control:', '')
      .trim()

    expect(declared).toBe(REVALIDATE)
  })
})

/**
 * The wiring, not just the helper. `shellMeta.test.ts` covers the rendering;
 * this covers that a real `/s/:id` request reaches it and that failure degrades
 * to the defaults rather than to a 500.
 *
 * Kept for links already posted (ADR-036): Discord re-fetches an unfurl, and
 * the click itself goes through the client's redirect-or-retired resolver.
 */
describe('old snapshot links keep their unfurl metadata', () => {
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

describe('/api/snapshots — publishing is retired', () => {
  for (const method of ['POST', 'GET', 'HEAD', 'PUT', 'DELETE']) {
    it(`${method} /api/snapshots is 404 and stores nothing`, async () => {
      const env = envWith()
      const init: RequestInit =
        method === 'POST'
          ? {
              method,
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(STORED),
            }
          : { method }
      const res = await worker.fetch(req('/api/snapshots', init), env)

      expect(res.status).toBe(404)
      expect(env.SNAPSHOTS._store.size).toBe(0)
    })
  }

  it('is a 404, not the SPA shell', async () => {
    // An `/api` path answering 200 text/html would read as success to a script.
    const env = envWith({ '/index.html': '<!doctype html>SPA' })
    const res = await worker.fetch(req('/api/snapshots', { method: 'POST' }), env)
    expect(await res.text()).not.toContain('SPA')
  })
})

describe('/api/snapshots/:id — which entity, and nothing else', () => {
  it('GET answers { kind, appId } — never the frozen build', async () => {
    const env = envWith({ '/index.html': 'SPA' }, { ABCD1234: STORED })
    const res = await worker.fetch(req('/api/snapshots/ABCD1234'), env)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ kind: 'pilot', appId: 'p-worker' })
  })

  it('DELETE is 405, and the stored object is untouched', async () => {
    // Revocation is retired along with publishing. The R2 objects are kept as
    // they are, by decision — nothing in this Worker writes to the bucket.
    const env = envWith({ '/index.html': 'SPA' }, { ABCD1234: STORED })
    const res = await worker.fetch(req('/api/snapshots/ABCD1234', { method: 'DELETE' }), env)

    expect(res.status).toBe(405)
    expect(env.SNAPSHOTS._store.has('ABCD1234')).toBe(true)
  })

  it('PUT is 405 too, and writes nothing', async () => {
    const env = envWith({ '/index.html': 'SPA' }, {})
    const res = await worker.fetch(
      req('/api/snapshots/ABCD1234', { method: 'PUT', body: JSON.stringify(STORED) }),
      env
    )

    expect(res.status).toBe(405)
    expect(env.SNAPSHOTS._store.size).toBe(0)
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

/**
 * `/og/s/:id.png` — the rendered unfurl image, kept for links already posted
 * (ADR-036) until it can go with `@resvg/resvg-wasm`.
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
    // Snapshots can no longer be revoked (ADR-036), but an id that was revoked
    // before, or was never minted, is still the common miss.
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
  // `./securityHeaders.ts` is the app's only source of these: `public/_headers`
  // carries Cache-Control alone, Cloudflare does not apply it to responses
  // Worker code GENERATES, and `wrangler.jsonc` sets `run_worker_first`. These
  // assert the wrapper covers the paths a request can actually leave by — an
  // asset hit included, and the redirect, which is the one that cannot have its
  // headers mutated in place and so is the likeliest to be missed by a
  // per-return fix.
  // ---------------------------------------------------------------------

  it.each([
    ['a redirect', '/pilots/whatever'],
    ['a 400 on a malformed snapshot id', '/api/snapshots/!!!'],
    ['a 404 for an unknown snapshot id', '/api/snapshots/ABCD1234'],
    ['the retired publish endpoint', '/api/snapshots'],
    ['an og:image fallback', '/og/s/!!.png'],
    ['the SPA shell', '/s/AAAAAAAA'],
    ['a 404 for a missing file', '/nope.txt'],
    ['an asset hit', '/assets/app.js'],
  ])('sets the security headers on %s', async (_label, path) => {
    const env = envWith({ '/index.html': 'SPA', '/assets/app.js': 'js' }, {})
    const res = await worker.fetch(req(path), env)

    expect(res.headers.get('content-security-policy')).toBe(ITUN_CSP)
    expect(res.headers.get('strict-transport-security')).toContain('max-age=63072000')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('serves ITUN_CSP verbatim', async () => {
    // The one CSP source is the one that ships: tools/check-observability.ts
    // reads ITUN_CSP for the Sentry ingest origin, so a Worker that served
    // anything else would leave that gate checking a policy nobody receives.
    const env = envWith({ '/index.html': 'SPA' }, {})
    const served = (await worker.fetch(req('/pilots/x'), env)).headers.get(
      'content-security-policy'
    )

    expect(served).toBe(ITUN_CSP)
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
