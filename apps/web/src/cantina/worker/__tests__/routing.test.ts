import { describe, expect, it } from 'bun:test'
import { NATIVE_FETCH_GLOBALS } from '../../../../test/env'
import { basePathOf, SITE } from '../../lib/site'
import type { Env } from '../index'
import worker from '../index'

/**
 * The Cantina's Worker code at salvageunion.io/build (ADR-048), which su-srd's
 * Worker runs first for every request under the base: it reads each answer
 * through an asset binding that answers a miss with the shell (see
 * `../index.ts` and apps/web/src/worker/build.ts).
 *
 * The rule that has already broken production: `/assets/*` on a miss must be
 * **404**, never the SPA shell. Answering 200 with HTML let the `immutable`
 * header pin that HTML into the HTTP cache for a year under a rotated chunk's
 * URL. The Worker can only answer a miss it is handed, so su-srd's
 * `run_worker_first` is held to handing it every one (its build.test.ts).
 */

const BASE = '/build'
const SHELL = '<!doctype html><html lang="en">SPA'
const CSP = "default-src 'self'"
const IMMUTABLE = 'public, max-age=31536000, immutable'
const CHUNK = `${BASE}/assets/index-C0FFEE12.js`
const ICON = `${BASE}/icon-192.png`

/**
 * A fake asset binding in `single-page-application` mode, the way Static
 * Assets answers: a file as itself, any miss as the shell (`200 text/html`),
 * `_headers` on every answer (the CSP everywhere, `immutable` under
 * `/build/assets/*`), and a `304` for a matching `If-None-Match`. Records every
 * path it is asked for.
 */
function assetsWith(files: Record<string, { body: string; type: string }>) {
  const asked: string[] = []
  return {
    asked,
    async fetch(request: Request): Promise<Response> {
      const path = new URL(request.url).pathname
      asked.push(path)
      const file = files[path] ?? { body: SHELL, type: 'text/html; charset=utf-8' }
      const etag = `"${file.body.length}-${file.type}"`
      const headers = new Headers({
        'content-type': file.type,
        etag,
        'content-security-policy': CSP,
        'cache-control': path.startsWith(`${BASE}/assets/`)
          ? IMMUTABLE
          : 'public, max-age=0, must-revalidate',
      })
      if (request.headers.get('if-none-match') === etag) {
        return new Response(null, { status: 304, headers })
      }
      return new Response(file.body, { status: 200, headers })
    },
  }
}

function envWith(
  files: Record<string, { body: string; type: string }> = {
    [CHUNK]: { body: 'export const chunk = 1', type: 'text/javascript' },
    [ICON]: { body: 'PNG', type: 'image/png' },
  }
) {
  return { ASSETS: assetsWith(files), BASE_PATH: BASE } as Env & {
    ASSETS: ReturnType<typeof assetsWith>
  }
}

/**
 * The runtime's own `Request`: happy-dom's (preloaded for this workspace) drops
 * `Sec-Fetch-*` as a browser does, and a navigation is told by that header.
 */
const { Request } = NATIVE_FETCH_GLOBALS

/** A request for an app path (`/p/x`), under the base on salvageunion.io. */
const req = (path: string, headers: Record<string, string> = {}) =>
  new Request(`https://salvageunion.io${BASE}${path}`, { headers })
/** A browser opening `url` (`Sec-Fetch-Mode: navigate`). */
const navigateTo = (url: string) => new Request(url, { headers: { 'sec-fetch-mode': 'navigate' } })
/** A module import: what a tab still running the previous build sends. */
const importOf = (path: string) =>
  req(path, { 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'script' })

function expectNotFound(res: Response) {
  expect(res.status).toBe(404)
  expect(res.headers.get('cache-control')).toBe('no-store')
  expect(res.headers.get('content-type')).not.toContain('text/html')
}

describe('/assets/* — a miss must 404, never the shell', () => {
  it('404s a rotated-away chunk instead of returning the SPA shell', async () => {
    const env = envWith()
    const res = await worker.fetch(importOf('/assets/index-DEADBEEF.js'), env)

    expectNotFound(res)
    expect(await res.text()).not.toContain('SPA')
    // Asked of the binding, which answered with the shell.
    expect(env.ASSETS.asked).toEqual([`${BASE}/assets/index-DEADBEEF.js`])
  })

  it('404s it for a HEAD and for a navigation too', async () => {
    const head = new Request(`https://salvageunion.io${BASE}/assets/index-DEADBEEF.js`, {
      method: 'HEAD',
    })
    expectNotFound(await worker.fetch(head, envWith()))
    expectNotFound(
      await worker.fetch(
        navigateTo(`https://salvageunion.io${BASE}/assets/index-DEADBEEF.js`),
        envWith()
      )
    )
  })

  it('404s a revalidation against the shell a cache pinned under the chunk', async () => {
    const env = envWith()
    const pinned = await env.ASSETS.fetch(req('/assets/index-DEADBEEF.js'))
    const etag = pinned.headers.get('etag') ?? ''
    env.ASSETS.asked.length = 0

    const res = await worker.fetch(req('/assets/index-DEADBEEF.js', { 'if-none-match': etag }), env)

    expectNotFound(res)
  })

  it('passes a chunk that is there through, immutable', async () => {
    const env = envWith()
    const res = await worker.fetch(importOf('/assets/index-C0FFEE12.js'), env)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/javascript')
    expect(res.headers.get('cache-control')).toBe(IMMUTABLE)
    expect(await res.text()).toBe('export const chunk = 1')
    expect(env.ASSETS.asked).toEqual([CHUNK])
  })

  it("passes a chunk's 304 through", async () => {
    const env = envWith()
    const etag = (await env.ASSETS.fetch(req('/assets/index-C0FFEE12.js'))).headers.get('etag')
    const res = await worker.fetch(
      req('/assets/index-C0FFEE12.js', { 'if-none-match': etag ?? '' }),
      env
    )

    expect(res.status).toBe(304)
  })
})

describe('a missing FILE is 404, not the shell', () => {
  for (const path of [
    '/foo.png',
    '/favicon.ico',
    '/robots.txt',
    '/apple-touch-icon.png',
    '/manifest.json',
    '/deep/path/thing.txt',
    '/missing.html',
  ]) {
    it(`404s ${path}`, async () => {
      const res = await worker.fetch(req(path), envWith())

      expectNotFound(res)
      expect(await res.text()).not.toContain('SPA')
    })
  }

  it('passes a file that is there through', async () => {
    const res = await worker.fetch(req('/icon-192.png'), envWith())

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('content-security-policy')).toBe(CSP)
  })

  it('reads a dot only in the last segment', async () => {
    // `/p/mech/v1.2` is the deliberate edge: a dot in the LAST segment reads as
    // a file, so it 404s. If a route ever needs one, this rule is what to revisit.
    expect((await worker.fetch(req('/p/mech/v1.2'), envWith())).status).toBe(404)
    expect((await worker.fetch(req('/p/v1.2/abc'), envWith())).status).toBe(200)
  })
})

/** A browser opening any client route gets the shell, `_headers` and all. */
describe('a navigation gets the shell', () => {
  for (const path of ['/', '/p/pilot/x', '/mechs/new?kind=x', '/sheet/pilot/xyz']) {
    it(`serves the shell with 200 and the CSP for ${path}`, async () => {
      const env = envWith()
      const res = await worker.fetch(navigateTo(`https://salvageunion.io${BASE}${path}`), env)

      expect(res.status).toBe(200)
      expect(await res.text()).toBe(SHELL)
      expect(res.headers.get('content-security-policy')).toBe(CSP)
      expect(res.headers.get('cache-control')).not.toContain('immutable')
      // The asset server's own answer, never a shared thing's preview.
      expect(env.ASSETS.asked).toEqual([`${BASE}${path.split('?')[0]}`])
    })
  }
})

/** The Dashboard and the link-preview surface draw no Union bar, from the first paint. */
describe('a route that draws no Union bar', () => {
  for (const path of ['/dashboard/abc', '/og/pilot/abc']) {
    it(`gets a shell marked to hide it for ${path}`, async () => {
      const res = await worker.fetch(navigateTo(`https://salvageunion.io${BASE}${path}`), envWith())
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('<!doctype html><html data-union-bar-hidden lang="en">SPA')
      expect(res.headers.get('content-security-policy')).toBe(CSP)
    })
  }

  it('leaves a file alone', async () => {
    const env = envWith({ [`${BASE}/dashboard/x.png`]: { body: 'png', type: 'image/png' } })
    const res = await worker.fetch(req('/dashboard/x.png'), env)
    expect(await res.text()).toBe('png')
  })
})

/**
 * A client route asked for without `Sec-Fetch-Mode: navigate` — a crawler, or
 * Discord unfurling a `/p/` link — gets the same shell a browser does.
 */
describe('a client route that is not a navigation gets the shell', () => {
  for (const path of ['/p/pilot/abc', '/s/AAAAAAAA', '/sheet/pilot/xyz', '/deep/unknown/route']) {
    it(`serves the shell with 200 for ${path}`, async () => {
      const env = envWith()
      const res = await worker.fetch(req(path), env)

      expect(res.status).toBe(200)
      expect(await res.text()).toContain('SPA')
      expect(res.headers.get('content-security-policy')).toBe(CSP)
    })
  }

  it("reads a shared thing's shell from the base's directory", async () => {
    const env = envWith()
    await worker.fetch(req('/p/pilot/abc'), env)
    // The base's directory, never `index.html`, which the asset server may redirect.
    expect(env.ASSETS.asked).toEqual([`${BASE}/`])
  })
})

/**
 * Search lists the front door, the Starter Set and public sheets; every other
 * client route is private or empty to a crawler, so its shell says `noindex`.
 */
describe('only the public client routes are indexable', () => {
  for (const path of ['/', '/starter', '/starter/pilot/bonesaw', '/p/pilot/abc']) {
    it(`leaves ${path} indexable`, async () => {
      const res = await worker.fetch(navigateTo(`https://salvageunion.io${BASE}${path}`), envWith())
      expect(res.headers.get('x-robots-tag')).toBeNull()
    })
  }

  for (const path of ['/sheet/pilot/xyz', '/games/g1', '/pilots/new', '/settings', '/s/AAAAAAAA']) {
    it(`marks ${path} noindex, keeping the shell and its headers`, async () => {
      const res = await worker.fetch(navigateTo(`https://salvageunion.io${BASE}${path}`), envWith())
      expect(res.status).toBe(200)
      expect(await res.text()).toBe(SHELL)
      expect(res.headers.get('x-robots-tag')).toBe('noindex')
      expect(res.headers.get('content-security-policy')).toBe(CSP)
    })
  }

  it("marks an invite's unfurl noindex", async () => {
    const res = await worker.fetch(req('/invite/abc123'), envWith())
    expect(res.headers.get('x-robots-tag')).toBe('noindex')
  })

  it('leaves files alone', async () => {
    const res = await worker.fetch(req('/icon-192.png'), envWith())
    expect(res.headers.get('x-robots-tag')).toBeNull()
  })
})

/**
 * The Cantina keeps no About or Changelog of its own: both tools share the SRD's, so
 * the old addresses, under the base or on the old host, 301 straight there.
 */
describe('the doc pages 301 to the SRD', () => {
  const cases: [string, string][] = [
    [`https://salvageunion.io${BASE}/about`, 'https://salvageunion.io/about/'],
    [`https://salvageunion.io${BASE}/about/`, 'https://salvageunion.io/about/'],
    [`https://salvageunion.io${BASE}/changelog`, 'https://salvageunion.io/changelog/'],
  ]
  for (const [from, to] of cases) {
    it(`${from} → ${to}`, async () => {
      const env = envWith()
      const res = await worker.fetch(navigateTo(from), env)

      expect(res.status).toBe(301)
      expect(res.headers.get('location')).toBe(to)
      expect(env.ASSETS.asked).toEqual([])
    })
  }

  it("a Worker Preview's go to its own SRD (`SRD_ORIGIN`)", async () => {
    const srd = 'https://pr-1-su-srd.example.workers.dev'
    const env = { ...envWith(), SRD_ORIGIN: srd }
    const res = await worker.fetch(
      navigateTo(`https://pr-1-su-srd.example.workers.dev${BASE}/changelog`),
      env
    )

    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe(`${srd}/changelog/`)
  })
})

/**
 * The retired addresses links in Discord history still point at. Those links
 * name intheunionnow.com, whose zone Redirect Rule sends every path to the same
 * path here; the Worker sends each retired one on to where it lives now.
 */
describe('a retired address 301s to where it lives now', () => {
  const cases: [string, string][] = [
    ['/games', '/'],
    ['/games?from=discord', '/?from=discord'],
    ['/games/g1/view/pilot/row-1', '/sheet/pilot/row-1'],
    ['/join/A1B2C3D4', '/invite/A1B2C3D4'],
    ['/join/A1B2C3D4?ref=dm', '/invite/A1B2C3D4?ref=dm'],
  ]
  for (const [from, to] of cases) {
    it(`${BASE}${from} → ${BASE}${to}`, async () => {
      const env = envWith()
      const res = await worker.fetch(navigateTo(`https://salvageunion.io${BASE}${from}`), env)

      expect(res.status).toBe(301)
      expect(res.headers.get('location')).toBe(`${BASE}${to}`)
      expect(env.ASSETS.asked).toEqual([])
    })
  }

  it('leaves a live route under a retired prefix alone', async () => {
    for (const path of ['/games/g1', '/join/a/b']) {
      const res = await worker.fetch(navigateTo(`https://salvageunion.io${BASE}${path}`), envWith())
      expect(res.status).toBe(200)
    }
  })
})

describe('outside the base on any other host', () => {
  it("301s the root and the bare base to the base's directory", async () => {
    for (const url of [
      'https://salvageunion.io/build',
      'https://salvageunion.io/build?x=1',
      'http://localhost:5173/',
      'https://pr-1-su-srd.alxjrvs.workers.dev/',
    ]) {
      const res = await worker.fetch(navigateTo(url), envWith())
      expect(res.status).toBe(301)
      expect(res.headers.get('location')).toBe(`${BASE}/${new URL(url).search}`)
    }
  })

  it('404s anything else: The Cantina serves nothing outside its base', async () => {
    for (const url of ['https://salvageunion.io/buildings', 'http://localhost:5173/p/pilot/x']) {
      const env = envWith()
      const res = await worker.fetch(navigateTo(url), env)
      expect(res.status).toBe(404)
      expect(res.headers.get('cache-control')).toBe('no-store')
      expect(env.ASSETS.asked).toEqual([])
    }
  })
})

describe('the deploy', () => {
  it('serves the base the app is built for', async () => {
    // srd's Worker serves the Cantina; read as text, since an app never
    // imports another app's files.
    const config = await Bun.file(new URL('../../../../wrangler.jsonc', import.meta.url)).text()
    const bases = [...config.matchAll(/"BASE_PATH":\s*"([^"]*)"/g)].map((m) => m[1])
    expect(bases.length).toBeGreaterThan(0)
    for (const base of bases) expect(base).toBe(basePathOf(SITE.base))
  })

  it("sets Convex Auth's SITE_URL to where the app is served, on every deploy", async () => {
    const workflow = await Bun.file(
      new URL('../../../../../../.github/workflows/deploy-cloudflare.yml', import.meta.url)
    ).text()
    const siteUrlEnv = workflow.match(/^\s*CANTINA_SITE_URL:\s*(\S+)\s*$/m)?.[1]
    expect(siteUrlEnv).toBe(`${SITE.origin}${basePathOf(SITE.base)}`)
    expect(workflow).toContain('bunx convex env set SITE_URL "$CANTINA_SITE_URL"')
  })
})

describe('the error endpoints under the base, logged for Workers Issues', () => {
  it('POST /__errors logs a browser report as cantina’s and answers 204', async () => {
    const env = envWith()
    const logged: unknown[][] = []
    const realConsoleError = console.error
    console.error = (...args: unknown[]) => {
      logged.push(args)
    }
    try {
      const res = await worker.fetch(
        new Request(`https://salvageunion.io${BASE}/__errors`, {
          method: 'POST',
          body: JSON.stringify({ message: 'boom' }),
        }),
        env
      )
      expect(res.status).toBe(204)
    } finally {
      console.error = realConsoleError
    }
    expect(logged[0]?.[1]).toMatchObject({ source: 'browser', app: 'cantina' })
    expect(env.ASSETS.asked).toEqual([])
  })

  it('POST /__convex-logs answers 503 while the stream secret is unset', async () => {
    const res = await worker.fetch(
      new Request(`https://salvageunion.io${BASE}/__convex-logs`, { method: 'POST', body: '[]' }),
      envWith()
    )
    expect(res.status).toBe(503)
  })

  it('POST /__convex-logs refuses an unsigned delivery once the secret is set', async () => {
    const env = { ...envWith(), CONVEX_LOG_STREAM_SECRET: 'whsec' }
    const res = await worker.fetch(
      new Request(`https://salvageunion.io${BASE}/__convex-logs`, { method: 'POST', body: '[]' }),
      env
    )
    expect(res.status).toBe(401)
  })
})
