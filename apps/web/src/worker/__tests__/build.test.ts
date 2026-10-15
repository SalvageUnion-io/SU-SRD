import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BUILD_BASE, CANTINA_CSP, RUN_WORKER_FIRST, spaAssets } from '../build'
import type { Env } from '../index'
import worker from '../index'

/**
 * The Cantina under `/build`, served by this Worker (`../build.ts`): srd's
 * binding is `not_found_handling: none`, so the Cantina's Worker gets a
 * binding that answers a miss under the base with the shell, as SPA mode
 * would, and every answer carrying a CSP gets the Cantina's.
 */

const SHELL = '<!doctype html>Cantina shell'
const SRD_404 = '<!doctype html><title>404 - Page Not Found</title>'
const SRD_CSP = "default-src 'self'; connect-src 'self'"
const IMMUTABLE = 'public, max-age=31536000, immutable'
const CHUNK = `${BUILD_BASE}/assets/index-C0FFEE12.js`

/**
 * A fake binding with `not_found_handling: none`: a file as itself with srd's
 * `_headers` (its CSP everywhere), a miss as a bare 404. Records every path.
 */
function assetsWith(files: Record<string, { body: string; type: string }>) {
  const asked: string[] = []
  return {
    asked,
    async fetch(request: Request): Promise<Response> {
      const path = new URL(request.url).pathname
      asked.push(path)
      const file = files[path]
      if (file === undefined) return new Response(null, { status: 404 })
      return new Response(file.body, {
        status: 200,
        headers: {
          'content-type': file.type,
          'content-security-policy': SRD_CSP,
          'cache-control': path.includes('/assets/')
            ? IMMUTABLE
            : 'public, max-age=0, must-revalidate',
        },
      })
    },
  }
}

const FILES = {
  [`${BUILD_BASE}/`]: { body: SHELL, type: 'text/html; charset=utf-8' },
  [CHUNK]: { body: 'export const chunk = 1', type: 'text/javascript' },
  '/404': { body: SRD_404, type: 'text/html; charset=utf-8' },
}

function envWith(files: Record<string, { body: string; type: string }> = FILES) {
  return { ASSETS: assetsWith(files), BASE_PATH: BUILD_BASE } as Env & {
    ASSETS: ReturnType<typeof assetsWith>
  }
}

const WRANGLER: unknown = (
  (await import(join(import.meta.dir, '../../../wrangler.jsonc'))) as { default: unknown }
).default

const req = (path: string, init?: RequestInit) =>
  new Request(`https://salvageunion.io${path}`, init)

describe('wrangler.jsonc agrees with the Worker', () => {
  // Bun's JSONC loader, as tools/check-workers.ts reads it.
  const config = WRANGLER as {
    assets: { run_worker_first: unknown }
    vars: { BASE_PATH: string; CONVEX_URL: string }
    previews: { vars: Record<string, string> }
  }
  const workflow = (name: string) =>
    readFileSync(join(import.meta.dir, `../../../../../.github/workflows/${name}`), 'utf8')

  it('runs the script first for /build and below, and nothing else', () => {
    expect(config.assets.run_worker_first).toEqual(RUN_WORKER_FIRST)
  })

  it('serves the Cantina under BUILD_BASE in production and in a Preview', () => {
    expect(config.vars.BASE_PATH).toBe(BUILD_BASE)
    expect(config.previews.vars.BASE_PATH).toBe(BUILD_BASE)
  })

  it('reads link previews from the Convex deployment the Cantina is built against', () => {
    const built = workflow('deploy-cloudflare.yml').match(
      /^\s*CANTINA_CONVEX_URL:\s*(\S+)\s*$/m
    )?.[1]
    expect(built).toBeString()
    expect(config.vars.CONVEX_URL).toBe(built as string)
  })

  it('points a Worker Preview at the staging deployment its Cantina is built against', () => {
    const built = workflow('deploy-preview.yml').match(/^\s*STAGING_CONVEX_URL:\s*(\S+)\s*$/m)?.[1]
    expect(built).toBeString()
    // A Preview inherits none of the top-level vars.
    expect(config.previews.vars).toEqual({ CONVEX_URL: built as string, BASE_PATH: BUILD_BASE })
  })

  it("sets the Cantina's own CSP, the one in its _headers", () => {
    const headers = readFileSync(join(import.meta.dir, '../../cantina/public/_headers'), 'utf8')
    const csp = headers.match(/^\s*Content-Security-Policy: (.+)$/m)?.[1]
    expect(csp).toBe(CANTINA_CSP)
    expect(CANTINA_CSP).toContain("connect-src 'self'")
    expect(CANTINA_CSP).toContain('wss://*.convex.cloud')
  })
})

describe('/build/* — the Cantina, answered as a single-page app', () => {
  it('answers a client route with the shell, carrying the Cantina CSP', async () => {
    const env = envWith()
    const res = await worker.fetch(req(`${BUILD_BASE}/pilots/new`), env)

    expect(res.status).toBe(200)
    expect(await res.text()).toBe(SHELL)
    expect(res.headers.get('content-security-policy')).toBe(CANTINA_CSP)
    // Not a public page: kept out of search.
    expect(res.headers.get('x-robots-tag')).toBe('noindex')
    // The miss, then the shell: SPA mode, emulated.
    expect(env.ASSETS.asked).toEqual([`${BUILD_BASE}/pilots/new`, `${BUILD_BASE}/`])
  })

  it('404s a rotated-away chunk with no-store, never the shell', async () => {
    const res = await worker.fetch(req(`${BUILD_BASE}/assets/index-DEADBEEF.js`), envWith())

    expect(res.status).toBe(404)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.text()).not.toContain(SHELL)
  })

  it('passes a chunk that is there through, immutable', async () => {
    const res = await worker.fetch(req(CHUNK), envWith())

    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe(IMMUTABLE)
    expect(await res.text()).toBe('export const chunk = 1')
  })

  it('301s /build itself to /build/', async () => {
    const res = await worker.fetch(req(BUILD_BASE), envWith())

    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe(`${BUILD_BASE}/`)
  })

  it("301s a retired doc page to the SRD's, on the request's own origin", async () => {
    const res = await worker.fetch(
      new Request(`https://pr-7-su-srd.example.workers.dev${BUILD_BASE}/about`),
      envWith()
    )

    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://pr-7-su-srd.example.workers.dev/about/')
  })

  it('answers the Cantina sitemap from the binding: the build writes it', async () => {
    const env = envWith()
    await worker.fetch(req(`${BUILD_BASE}/sitemap.xml`), env)

    expect(env.ASSETS.asked).toContain(`${BUILD_BASE}/sitemap.xml`)
  })
})

describe('the SRD is untouched', () => {
  it('still answers its own miss with its 404 page and its own CSP', async () => {
    const env = envWith()
    const res = await worker.fetch(req('/chassis/nope/'), env)

    expect(res.status).toBe(404)
    expect(await res.text()).toBe(SRD_404)
    expect(res.headers.get('content-security-policy')).toBe(SRD_CSP)
  })

  it('never treats a path that merely starts with /build as the Cantina', async () => {
    const env = envWith()
    const res = await worker.fetch(req('/buildings/'), env)

    expect(res.status).toBe(404)
    expect(env.ASSETS.asked).toEqual(['/404'])
  })
})

describe('spaAssets', () => {
  it('leaves a miss outside the base a miss', async () => {
    const assets = assetsWith(FILES)
    const res = await spaAssets(assets, BUILD_BASE).fetch(req('/nope'))

    expect(res.status).toBe(404)
    expect(assets.asked).toEqual(['/nope'])
  })
})
