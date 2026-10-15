import { describe, expect, it } from 'bun:test'
import { NATIVE_FETCH_GLOBALS } from '../../../test/env'
import { basePathOf, SITE } from '../../lib/site'
import type { Env } from '../index'
import worker from '../index'
import { RUN_WORKER_FIRST } from '../legacyHost'

/**
 * The cantina Worker at salvageunion.io/build (ADR-048), which runs first for
 * every request (`run_worker_first`): under the base it reads each answer
 * through the asset binding (`single-page-application` mode — see
 * `../index.ts`), outside it it answers intheunionnow.com's 301s
 * (`../legacyHost.ts`).
 *
 * The rule that has already broken production: `/assets/*` on a miss must be
 * **404**, never the SPA shell. Answering 200 with HTML let the `immutable`
 * header pin that HTML into the HTTP cache for a year under a rotated chunk's
 * URL. The Worker can only answer a miss it is handed, so `wrangler.jsonc`'s
 * `run_worker_first` is held to handing it every one.
 */

const BASE = '/build'
const SHELL = '<!doctype html>SPA'
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
 * intheunionnow.com, where the Cantina lived until ADR-048: every request is a 301 to
 * the same page under salvageunion.io/build, query kept, and a retired address
 * goes straight to where it lives now. One hop, decided without the asset
 * binding.
 */
/**
 * The Cantina keeps no About or Changelog of its own: both tools share the SRD's, so
 * the old addresses, under the base or on the old host, 301 straight there.
 */
describe('the doc pages 301 to the SRD', () => {
  const cases: [string, string][] = [
    [`https://salvageunion.io${BASE}/about`, 'https://salvageunion.io/about/'],
    [`https://salvageunion.io${BASE}/about/`, 'https://salvageunion.io/about/'],
    [`https://salvageunion.io${BASE}/changelog`, 'https://salvageunion.io/changelog/'],
    ['https://intheunionnow.com/about', 'https://salvageunion.io/about/'],
    ['https://www.intheunionnow.com/changelog', 'https://salvageunion.io/changelog/'],
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
      navigateTo(`https://pr-1-su-cantina.example.workers.dev${BASE}/changelog`),
      env
    )

    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe(`${srd}/changelog/`)
  })
})

describe('the old host 301s to salvageunion.io/build', () => {
  const cases: [string, string][] = [
    ['https://intheunionnow.com/', '/'],
    ['https://intheunionnow.com/p/pilot/abc', '/p/pilot/abc'],
    ['https://intheunionnow.com/invite/A1B2C3D4?ref=dm', '/invite/A1B2C3D4?ref=dm'],
    ['https://intheunionnow.com/sheet/mech/row-2', '/sheet/mech/row-2'],
    ['https://intheunionnow.com/assets/index-DEADBEEF.js', '/assets/index-DEADBEEF.js'],
    ['https://www.intheunionnow.com/settings', '/settings'],
    // The retired addresses, mapped on the way.
    ['https://intheunionnow.com/games', '/'],
    ['https://intheunionnow.com/games?from=discord', '/?from=discord'],
    ['https://intheunionnow.com/games/g1/view/pilot/row-1', '/sheet/pilot/row-1'],
    ['https://intheunionnow.com/join/A1B2C3D4', '/invite/A1B2C3D4'],
    ['https://intheunionnow.com/join/A1B2C3D4?ref=dm', '/invite/A1B2C3D4?ref=dm'],
    // Under a retired prefix but no retired shape: its own path, the app's 404.
    ['https://intheunionnow.com/join/a/b', '/join/a/b'],
  ]
  for (const [from, to] of cases) {
    it(`${from} → ${to}`, async () => {
      const env = envWith()
      const res = await worker.fetch(navigateTo(from), env)

      expect(res.status).toBe(301)
      expect(res.headers.get('location')).toBe(`https://salvageunion.io${BASE}${to}`)
      expect(env.ASSETS.asked).toEqual([])
    })
  }
})

describe('outside the base on any other host', () => {
  it("301s the root and the bare base to the base's directory", async () => {
    for (const url of [
      'https://salvageunion.io/build',
      'https://salvageunion.io/build?x=1',
      'http://localhost:5173/',
      'https://pr-1-su-cantina.alxjrvs.workers.dev/',
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

describe('wrangler.jsonc', () => {
  type Config = {
    name: string
    compatibility_date: string
    routes: { pattern: string; zone_name?: string; custom_domain?: boolean }[]
    vars?: Record<string, string>
    previews?: { vars?: Record<string, string> }
    assets: Record<string, unknown>
    env?: unknown
  }
  const load = async () =>
    ((await import('../../../wrangler.jsonc')) as { default: Config }).default

  it('is in single-page-application mode, with the Worker first', async () => {
    const config = await load()

    expect(config.assets.not_found_handling).toBe('single-page-application')
    expect(config.assets.run_worker_first).toBe(RUN_WORKER_FIRST)
    expect(config.assets.directory).toBe('./dist')
  })

  /**
   * Which requests Static Assets hands the Worker before it looks for a file,
   * as its router decides (workers-shared `router-worker`): `true` is every
   * request; in a list, a negative (`!`) match goes to the assets ahead of any
   * positive one, a positive match to the Worker, and anything else to the
   * assets — whose `single-page-application` mode answers a miss with the shell,
   * navigation or not.
   */
  function workerFirst(setting: unknown, path: string): boolean {
    if (typeof setting === 'boolean') return setting
    const patterns = (setting ?? []) as string[]
    const matches = (pattern: string) =>
      new RegExp(`^${pattern.split('*').map(RegExp.escape).join('.*')}$`).test(path)
    if (patterns.some((p) => p.startsWith('!') && matches(p.slice(1)))) return false
    return patterns.some((p) => !p.startsWith('!') && matches(p))
  }

  it('sends every miss the Worker turns into a 404 to the Worker first', async () => {
    const { assets } = await load()
    // A miss here, answered by the assets, would be the shell: `200 text/html`,
    // and `immutable` under `/assets/`.
    for (const path of [
      `${BASE}/assets/index-DEADBEEF.js`,
      `${BASE}/assets/style-DEADBEEF.css`,
      `${BASE}/foo.png`,
      `${BASE}/og/pilot/p-1.png`,
      `${BASE}/p/pilot/p-1`,
      `${BASE}`,
      '/',
      '/games/g1/view/pilot/row-1',
    ]) {
      expect({ path, workerFirst: workerFirst(assets.run_worker_first, path) }).toEqual({
        path,
        workerFirst: true,
      })
    }
  })

  it('reads routing the way the asset router does', () => {
    // The shape that shipped the shell for a rotated chunk under `/build`.
    const shipped = ['/*', '!/build/*', '/build/assets/*']
    expect(workerFirst(shipped, '/build/assets/index-DEADBEEF.js')).toBe(false)
    expect(workerFirst(shipped, '/games')).toBe(true)
    expect(workerFirst(true, '/build/assets/index-DEADBEEF.js')).toBe(true)
    expect(workerFirst(undefined, '/build/assets/index-DEADBEEF.js')).toBe(false)
  })

  it('serves the base the app is built for, and leaves salvageunion.io/build to su-srd', async () => {
    const config = await load()

    expect(config.vars?.BASE_PATH).toBe(basePathOf(SITE.base))
    // su-srd serves `/build` (apps/srd/src/worker/build.ts): a route here
    // would run ahead of its Custom Domain with this Worker's stale build.
    expect(config.routes.map((route) => route.pattern)).not.toContain(
      `${new URL(SITE.origin).host}${basePathOf(SITE.base)}*`
    )
    // The old host stays attached, so its 301s keep answering.
    for (const host of ['intheunionnow.com', 'www.intheunionnow.com']) {
      expect(config.routes).toContainEqual({ pattern: host, custom_domain: true })
    }
    // One configuration: `wrangler deploy` deploys it, with no `--env`.
    expect(config.env).toBeUndefined()
  })
  it('reads link previews from the Convex deployment the SPA is built against', async () => {
    const config = await load()
    const workflow = await Bun.file(
      new URL('../../../../../.github/workflows/deploy-cloudflare.yml', import.meta.url)
    ).text()
    const built = workflow.match(/^\s*CANTINA_CONVEX_URL:\s*(\S+)\s*$/m)?.[1]
    expect(built).toBeString()
    expect(config.vars?.CONVEX_URL).toBe(built)
  })

  it('points a Worker Preview at the staging deployment its SPA is built against', async () => {
    const config = await load()
    const workflow = await Bun.file(
      new URL('../../../../../.github/workflows/deploy-preview.yml', import.meta.url)
    ).text()
    const built = workflow.match(/^\s*STAGING_CONVEX_URL:\s*(\S+)\s*$/m)?.[1]
    expect(built).toBeString()
    // A preview inherits none of the top-level vars.
    expect(config.previews?.vars).toEqual({
      CONVEX_URL: built as string,
      BASE_PATH: basePathOf(SITE.base),
    })
  })

  it("sets Convex Auth's SITE_URL to where the app is served, on every deploy", async () => {
    const workflow = await Bun.file(
      new URL('../../../../../.github/workflows/deploy-cloudflare.yml', import.meta.url)
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
