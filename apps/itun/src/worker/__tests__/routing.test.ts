import { describe, expect, it } from 'bun:test'
import type { Env } from '../index'
import worker from '../index'

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

describe('/assets/* — a miss must 404, never the shell', () => {
  it('404s a rotated-away chunk instead of returning the SPA shell', async () => {
    const env = envWith()
    const res = await worker.fetch(req('/assets/index-DEADBEEF.js'), env)

    expect(res.status).toBe(404)
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

describe('wrangler.jsonc', () => {
  it('is in single-page-application mode, with the Worker only on a miss', async () => {
    const { default: config } = (await import('../../../wrangler.jsonc')) as {
      default: { compatibility_date: string; assets: Record<string, unknown> }
    }

    expect(config.assets.not_found_handling).toBe('single-page-application')
    // From 2025-04-01 a navigation miss is answered with the shell without
    // invoking the Worker (`assets_navigation_prefers_asset_serving`).
    expect(config.compatibility_date >= '2025-04-01').toBe(true)
    // Running the Worker first would route navigations through it, and its
    // responses would leave without `_headers` — the CSP among them.
    expect(config.assets.run_worker_first).toBeUndefined()
  })
})
