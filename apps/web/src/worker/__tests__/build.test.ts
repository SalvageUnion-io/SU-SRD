import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { APP_BASE } from '../../lib/appBase'
import { RUN_WORKER_FIRST, spaAssets } from '../app'
import type { Env } from '../env'
import { worker } from './worker'

/**
 * The app under `/build`, served by the one Worker (`../app.ts`): the
 * site's binding is `not_found_handling: none`, so its rules read a binding
 * that answers a miss under the base with the shell, as SPA mode would. Every
 * answer keeps the site's `_headers`, its one CSP included.
 */

const SHELL = '<!doctype html>app shell'
const SRD_404 = '<!doctype html><title>404 - Page Not Found</title>'
const SRD_CSP = "default-src 'self'; connect-src 'self'"
const IMMUTABLE = 'public, max-age=31536000, immutable'
const CHUNK = `${APP_BASE}/assets/index-C0FFEE12.js`

/**
 * A fake binding with `not_found_handling: none`: a file as itself with the reference site's
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
  [`${APP_BASE}/`]: { body: SHELL, type: 'text/html; charset=utf-8' },
  [CHUNK]: { body: 'export const chunk = 1', type: 'text/javascript' },
  '/404': { body: SRD_404, type: 'text/html; charset=utf-8' },
}

function envWith(files: Record<string, { body: string; type: string }> = FILES) {
  return { ASSETS: assetsWith(files) } as Env & {
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
    previews: {
      d1_databases: { binding: string; database_name: string }[]
    }
    d1_databases: { binding: string; database_name: string }[]
  }
  const workflow = (name: string) =>
    readFileSync(join(import.meta.dir, `../../../../../.github/workflows/${name}`), 'utf8')

  it('runs the script first for /build and below, and nothing else', () => {
    expect(config.assets.run_worker_first).toEqual(RUN_WORKER_FIRST)
  })

  it('migrates the shared database it reads before it ships, a Preview its own', () => {
    const name = (dbs: { binding: string; database_name: string }[]) =>
      dbs.find((db) => db.binding === 'SHARED')?.database_name
    expect(name(config.d1_databases)).toBe('su-shared')
    expect(name(config.previews.d1_databases)).toBe('su-shared-preview')
    expect(workflow('deploy-cloudflare.yml')).toContain('bun tools/d1-migrate.ts su-shared\n')
    expect(workflow('deploy-preview.yml')).toContain('bun tools/d1-migrate.ts su-shared-preview\n')
  })

  it('sets one CSP for the whole app, connecting to its own origin', () => {
    const headers = readFileSync(join(import.meta.dir, '../../../public/_headers'), 'utf8')
    const csp = headers.match(/^\s*Content-Security-Policy:\s*(.*)$/gm) ?? []
    expect(csp).toHaveLength(1)
    expect(csp[0]).toContain("connect-src 'self'")
    expect(csp[0]).not.toContain('convex')
  })
})

describe('/build/* — the app, answered as a single-page app', () => {
  it('answers a client route with the shell, carrying the site CSP', async () => {
    const env = envWith()
    const res = await worker.fetch(req(`${APP_BASE}/pilots/new`), env)

    expect(res.status).toBe(200)
    expect(await res.text()).toBe(SHELL)
    expect(res.headers.get('content-security-policy')).toBe(SRD_CSP)
    // Not a public page: kept out of search.
    expect(res.headers.get('x-robots-tag')).toBe('noindex')
    // The miss, then the shell: SPA mode, emulated.
    expect(env.ASSETS.asked).toEqual([`${APP_BASE}/pilots/new`, `${APP_BASE}/`])
  })

  it('404s a rotated-away chunk with no-store, never the shell', async () => {
    const res = await worker.fetch(req(`${APP_BASE}/assets/index-DEADBEEF.js`), envWith())

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
    const res = await worker.fetch(req(APP_BASE), envWith())

    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe(`${APP_BASE}/`)
  })

  it("301s a retired doc page to the SRD's, on the request's own origin", async () => {
    const res = await worker.fetch(
      new Request(`https://pr-7-su-srd.example.workers.dev${APP_BASE}/about`),
      envWith()
    )

    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://pr-7-su-srd.example.workers.dev/about/')
  })

  it('answers the app sitemap from the binding: the build writes it', async () => {
    const env = envWith()
    await worker.fetch(req(`${APP_BASE}/sitemap.xml`), env)

    expect(env.ASSETS.asked).toContain(`${APP_BASE}/sitemap.xml`)
  })
})

describe('the SRD is untouched', () => {
  it('still answers its own miss with its 404 page and the site CSP', async () => {
    const env = envWith()
    const res = await worker.fetch(req('/chassis/nope/'), env)

    expect(res.status).toBe(404)
    expect(await res.text()).toBe(SRD_404)
    expect(res.headers.get('content-security-policy')).toBe(SRD_CSP)
  })

  it('never treats a path that merely starts with /build as the app', async () => {
    const env = envWith()
    const res = await worker.fetch(req('/buildings/'), env)

    expect(res.status).toBe(404)
    expect(env.ASSETS.asked).toEqual(['/404'])
  })
})

describe('spaAssets', () => {
  it('leaves a miss outside the base a miss', async () => {
    const assets = assetsWith(FILES)
    const res = await spaAssets(assets, APP_BASE).fetch(req('/nope'))

    expect(res.status).toBe(404)
    expect(assets.asked).toEqual(['/nope'])
  })
})
