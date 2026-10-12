import { describe, expect, it } from 'bun:test'
import type { Env } from '../index'
import worker from '../index'
import { RETIRED_PATTERNS } from '../retiredRedirects'

/**
 * The itun Worker, which Static Assets runs only for a miss that is not a
 * navigation (`single-page-application` mode — see `../index.ts`).
 *
 * The rule that has already broken production: `/assets/*` on a miss must be
 * **404**, never the SPA shell. Answering 200 with HTML let the `immutable`
 * header pin that HTML into the HTTP cache for a year under a rotated chunk's
 * URL (#759).
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

function envWith(files: Record<string, string> = { '/': '<!doctype html>SPA' }) {
  return { ASSETS: assetsWith(files) } as Env & { ASSETS: ReturnType<typeof assetsWith> }
}

const req = (path: string) => new Request(`https://intheunionnow.com${path}`)
const navigate = (path: string) =>
  new Request(`https://intheunionnow.com${path}`, { headers: { 'sec-fetch-mode': 'navigate' } })

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
      // `/`, never `/index.html`, which the asset server may redirect.
      expect(env.ASSETS.asked).toEqual(['/'])
    })
  }
})

/**
 * Retired addresses that old Discord links still use (refit D6): a 301 to
 * exactly where the TanStack route used to send them, query string kept, with
 * a path and no origin. `run_worker_first` routes navigations for them here.
 */
describe('a retired address is a 301 to where it lives now', () => {
  const cases: [string, string][] = [
    ['/games', '/'],
    ['/games/', '/'],
    ['/games?from=discord', '/?from=discord'],
    ['/games/g1/view/pilot/row-1', '/sheet/pilot/row-1'],
    ['/games/g1/view/mech/row-2', '/sheet/mech/row-2'],
    ['/games/g1/view/crawler/row-3?tab=gear', '/sheet/crawler/row-3?tab=gear'],
    ['/join/A1B2C3D4', '/invite/A1B2C3D4'],
    ['/join/A1B2C3D4/', '/invite/A1B2C3D4'],
    ['/join/A1B2C3D4?ref=dm', '/invite/A1B2C3D4?ref=dm'],
  ]
  for (const [from, to] of cases) {
    it(`${from} → ${to}`, async () => {
      const env = envWith()
      const res = await worker.fetch(navigate(from), env)

      expect(res.status).toBe(301)
      expect(res.headers.get('location')).toBe(to)
      // Decided without the binding.
      expect(env.ASSETS.asked).toEqual([])
    })
  }

  it('404s a path under a retired prefix that names no retired shape', async () => {
    for (const path of [
      '/join/',
      '/join/a/b',
      '/games/g1/view/pilot',
      '/games/g1/view/pilot/x/y',
    ]) {
      const res = await worker.fetch(navigate(path), envWith())
      expect(res.status).toBe(404)
      expect(res.headers.get('cache-control')).toBe('no-store')
    }
  })

  it('leaves the live addresses beside them alone', async () => {
    for (const path of ['/games/g1', '/invite/A1B2C3D4', '/sheet/pilot/row-1']) {
      expect((await worker.fetch(req(path), envWith())).status).toBe(200)
    }
  })
})

describe('wrangler.jsonc', () => {
  it('is in single-page-application mode, with the Worker first only for retired addresses', async () => {
    const { default: config } = (await import('../../../wrangler.jsonc')) as {
      default: { compatibility_date: string; assets: Record<string, unknown> }
    }

    expect(config.assets.not_found_handling).toBe('single-page-application')
    // From 2025-04-01 a navigation miss is answered with the shell without
    // invoking the Worker (`assets_navigation_prefers_asset_serving`).
    expect(config.compatibility_date >= '2025-04-01').toBe(true)
    // Running the Worker first routes navigations through it, and its responses
    // leave without `_headers` — the CSP among them. So it runs first only for
    // the retired addresses, every one of which it answers with a redirect.
    expect(config.assets.run_worker_first).toEqual([...RETIRED_PATTERNS])
  })

  it('reads link previews from the Convex deployment the SPA is built against', async () => {
    const { default: config } = (await import('../../../wrangler.jsonc')) as {
      default: { vars?: { CONVEX_URL?: string } }
    }
    const workflow = await Bun.file(
      new URL('../../../../../.github/workflows/deploy-cloudflare.yml', import.meta.url)
    ).text()
    const built = workflow.match(/^\s*ITUN_CONVEX_URL:\s*(\S+)\s*$/m)?.[1]
    expect(built).toBeString()
    expect(config.vars?.CONVEX_URL).toBe(built)
  })
})
