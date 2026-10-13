import { describe, expect, it } from 'bun:test'
import { basePathOf, SITE } from '../../lib/site'
import type { Env } from '../index'
import worker from '../index'
import { RUN_WORKER_FIRST } from '../legacyHost'

/**
 * The itun Worker at salvageunion.io/build (ADR-048), which Static Assets runs
 * under the base only for a miss that is not a navigation
 * (`single-page-application` mode — see `../index.ts`), and outside it for
 * every request (intheunionnow.com's 301s, `../legacyHost.ts`).
 *
 * The rule that has already broken production: `/assets/*` on a miss must be
 * **404**, never the SPA shell. Answering 200 with HTML let the `immutable`
 * header pin that HTML into the HTTP cache for a year under a rotated chunk's
 * URL.
 */

/** A fake asset binding holding `files`; records every path it is asked for. */
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

const BASE = '/build'

function envWith(files: Record<string, string> = { [`${BASE}/`]: '<!doctype html>SPA' }) {
  return { ASSETS: assetsWith(files), BASE_PATH: BASE } as Env & {
    ASSETS: ReturnType<typeof assetsWith>
  }
}

/** A request for an app path (`/p/x`), under the base on salvageunion.io. */
const req = (path: string) => new Request(`https://salvageunion.io${BASE}${path}`)
/** A browser opening `url` (`Sec-Fetch-Mode: navigate`). */
const navigateTo = (url: string) => new Request(url, { headers: { 'sec-fetch-mode': 'navigate' } })

describe('/assets/* — a miss must 404, never the shell', () => {
  it('404s a rotated-away chunk instead of returning the SPA shell', async () => {
    const env = envWith()
    const res = await worker.fetch(req('/assets/index-DEADBEEF.js'), env)

    expect(res.status).toBe(404)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.text()).not.toContain('SPA')
    // Decided without the binding: there is nothing it could add.
    expect(env.ASSETS.asked).toEqual([])
  })
})

describe('a missing FILE is 404, not the shell', () => {
  for (const path of [
    '/favicon.ico',
    '/sitemap.xml',
    '/apple-touch-icon.png',
    '/manifest.json',
    '/deep/path/thing.txt',
  ]) {
    it(`404s ${path}`, async () => {
      const res = await worker.fetch(req(path), envWith())

      expect(res.status).toBe(404)
      expect(await res.text()).not.toContain('SPA')
    })
  }

  it('reads a dot only in the last segment', async () => {
    // `/p/mech/v1.2` is the deliberate edge: a dot in the LAST segment reads as
    // a file, so it 404s. If a route ever needs one, this rule is what to revisit.
    expect((await worker.fetch(req('/p/mech/v1.2'), envWith())).status).toBe(404)
    expect((await worker.fetch(req('/p/v1.2/abc'), envWith())).status).toBe(200)
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
      // The base's directory, never `index.html`, which the asset server may redirect.
      expect(env.ASSETS.asked).toEqual([`${BASE}/`])
    })
  }
})

/**
 * intheunionnow.com, where ITUN lived until ADR-048: every request is a 301 to
 * the same page under salvageunion.io/build, query kept, and a retired address
 * goes straight to where it lives now. One hop, decided without the asset
 * binding.
 */
describe('the old host 301s to salvageunion.io/build', () => {
  const cases: [string, string][] = [
    ['https://intheunionnow.com/', '/'],
    ['https://intheunionnow.com/p/pilot/abc', '/p/pilot/abc'],
    ['https://intheunionnow.com/invite/A1B2C3D4?ref=dm', '/invite/A1B2C3D4?ref=dm'],
    ['https://intheunionnow.com/sheet/mech/row-2', '/sheet/mech/row-2'],
    ['https://intheunionnow.com/assets/index-DEADBEEF.js', '/assets/index-DEADBEEF.js'],
    ['https://www.intheunionnow.com/about', '/about'],
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
      'https://preview-su-itun.alxjrvs.workers.dev/',
    ]) {
      const res = await worker.fetch(navigateTo(url), envWith())
      expect(res.status).toBe(301)
      expect(res.headers.get('location')).toBe(`${BASE}/${new URL(url).search}`)
    }
  })

  it('404s anything else: ITUN serves nothing outside its base', async () => {
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
    assets: Record<string, unknown>
    env?: unknown
  }
  const load = async () =>
    ((await import('../../../wrangler.jsonc')) as { default: Config }).default

  it('is in single-page-application mode, with the Worker first only outside the base', async () => {
    const config = await load()

    expect(config.assets.not_found_handling).toBe('single-page-application')
    // From 2025-04-01 a navigation miss is answered with the shell without
    // invoking the Worker (`assets_navigation_prefers_asset_serving`).
    expect(config.compatibility_date >= '2025-04-01').toBe(true)
    // Running the Worker first routes navigations through it, and its responses
    // leave without `_headers` — the CSP among them. So under the base it never
    // runs first; outside it, it answers every request with a 301 or a 404.
    expect(config.assets.run_worker_first).toEqual([...RUN_WORKER_FIRST])
    expect(config.assets.directory).toBe('./dist')
  })

  it('serves the base the app is built for, on the route that puts it at salvageunion.io/build', async () => {
    const config = await load()

    expect(config.vars?.BASE_PATH).toBe(basePathOf(SITE.base))
    // A route, not a Custom Domain: it runs before su-srd's Custom Domain on
    // the same hostname, so `/build*` never reaches srd.
    expect(config.routes).toContainEqual({
      pattern: `${new URL(SITE.origin).host}${basePathOf(SITE.base)}*`,
      zone_name: new URL(SITE.origin).host,
    })
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
    const built = workflow.match(/^\s*ITUN_CONVEX_URL:\s*(\S+)\s*$/m)?.[1]
    expect(built).toBeString()
    expect(config.vars?.CONVEX_URL).toBe(built)
  })

  it("sets Convex Auth's SITE_URL to where the app is served, on every deploy", async () => {
    const workflow = await Bun.file(
      new URL('../../../../../.github/workflows/deploy-cloudflare.yml', import.meta.url)
    ).text()
    const siteUrlEnv = workflow.match(/^\s*ITUN_SITE_URL:\s*(\S+)\s*$/m)?.[1]
    expect(siteUrlEnv).toBe(`${SITE.origin}${basePathOf(SITE.base)}`)
    expect(workflow).toContain('bunx convex env set SITE_URL "$ITUN_SITE_URL"')
  })
})
