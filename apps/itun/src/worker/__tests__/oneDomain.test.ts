import { describe, expect, it } from 'bun:test'
import type { Env } from '../index'
import worker from '../index'
import { patternsUnder, RETIRED_PATTERNS } from '../retiredRedirects'

/**
 * Refit S2 spike: the same Worker at salvageunion.io/build, deployed with
 * `wrangler deploy --env one-domain` (nothing deploys it yet). Its `BASE_PATH`
 * var is `/build`; every rule in `../index.ts` reads the path inside the app
 * and puts the base back on what it builds. `routing.test.ts` is the root.
 */

const BASE = '/build'

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

function envWith() {
  return {
    ASSETS: assetsWith({ [`${BASE}/`]: '<!doctype html>SPA' }),
    BASE_PATH: BASE,
  } as Env & { ASSETS: ReturnType<typeof assetsWith> }
}

const req = (path: string) => new Request(`https://salvageunion.io${path}`)
const navigate = (path: string) =>
  new Request(`https://salvageunion.io${path}`, { headers: { 'sec-fetch-mode': 'navigate' } })

describe('under /build', () => {
  it('404s a rotated-away chunk under the base, never the shell', async () => {
    const env = envWith()
    const res = await worker.fetch(req(`${BASE}/assets/index-DEADBEEF.js`), env)
    expect(res.status).toBe(404)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(env.ASSETS.asked).toEqual([])
  })

  it('404s a missing file under the base', async () => {
    expect((await worker.fetch(req(`${BASE}/favicon.ico`), envWith())).status).toBe(404)
  })

  it("serves the base's shell to a client route asked for without a navigation", async () => {
    for (const path of [`${BASE}/sheet/pilot/xyz`, `${BASE}/p/pilot/abc`, BASE]) {
      const env = envWith()
      const res = await worker.fetch(req(path), env)
      expect(res.status).toBe(200)
      expect(await res.text()).toContain('SPA')
      expect(env.ASSETS.asked).toEqual([`${BASE}/`])
    }
  })

  it('301s a retired address to where it lives now, under the same base', async () => {
    const cases: [string, string][] = [
      [`${BASE}/games`, `${BASE}/`],
      [`${BASE}/games/g1/view/mech/row-2`, `${BASE}/sheet/mech/row-2`],
      [`${BASE}/join/A1B2C3D4?ref=dm`, `${BASE}/invite/A1B2C3D4?ref=dm`],
    ]
    for (const [from, to] of cases) {
      const res = await worker.fetch(navigate(from), envWith())
      expect(res.status).toBe(301)
      expect(res.headers.get('location')).toBe(to)
    }
  })
})

type WorkerConfig = {
  name: string
  vars?: Record<string, string>
  assets: Record<string, unknown>
  env: Record<
    string,
    {
      name?: string
      routes: { pattern: string; zone_name?: string; custom_domain?: boolean }[]
      vars?: Record<string, string>
      assets: Record<string, unknown>
    }
  >
}

describe("wrangler.jsonc's one-domain environment", () => {
  it('deploys su-itun itself, routed /build* on salvageunion.io, with the same SPA rules', async () => {
    const { default: config } = (await import('../../../wrangler.jsonc')) as {
      default: WorkerConfig
    }
    const env = config.env['one-domain']
    expect(env).toBeDefined()
    if (env === undefined) return

    // Without `name`, wrangler deploys a second Worker, `su-itun-one-domain`.
    expect(env.name).toBe(config.name)
    // A route, not a Custom Domain: it runs before su-srd's Custom Domain.
    expect(env.routes).toContainEqual({
      pattern: 'salvageunion.io/build*',
      zone_name: 'salvageunion.io',
    })
    expect(env.vars?.BASE_PATH).toBe(BASE)
    // `vars` is not inherited, so the Convex deployment is restated: the same one.
    expect(env.vars?.CONVEX_URL).toBe(config.vars?.CONVEX_URL)
    expect(env.assets.not_found_handling).toBe('single-page-application')
    expect(env.assets.directory).toBe(config.assets.directory)
    expect(env.assets.run_worker_first).toEqual(patternsUnder(BASE))
    expect(patternsUnder(BASE)).toHaveLength(RETIRED_PATTERNS.length)
  })
})
