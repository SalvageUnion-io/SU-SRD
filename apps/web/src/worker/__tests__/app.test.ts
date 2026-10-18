import { describe, expect, it } from 'bun:test'
import { NATIVE_FETCH_GLOBALS } from '../../../test/env'
import { APP_BASE } from '../../lib/appBase'
import { appUrl, originOf } from '../../lib/site'
import { renderUnionBar } from '../../shell/unionBar'
import type { Env } from '../index'
import worker from '../index'

/**
 * The app at salvageunion.io/build (ADR-048), which the one Worker runs
 * first for every request under the base: it reads each answer through an
 * asset binding that answers a miss with the shell (see `../app.ts`).
 *
 * The rule that has already broken production: `/assets/*` on a miss must be
 * **404**, never the SPA shell. Answering 200 with HTML let the `immutable`
 * header pin that HTML into the HTTP cache for a year under a rotated chunk's
 * URL. The Worker can only answer a miss it is handed, so `run_worker_first`
 * is held to handing it every one (`build.test.ts`).
 */

const BASE = APP_BASE
const SHELL = '<!doctype html><html lang="en">SPA'
const CSP = "default-src 'self'"
const IMMUTABLE = 'public, max-age=31536000, immutable'
const CHUNK = `${BASE}/assets/index-C0FFEE12.js`
const ICON = `${BASE}/icon-192.png`
const NOT_FOUND_PAGE = '<!doctype html><title>404 - Page Not Found</title>'

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
    '/404': { body: NOT_FOUND_PAGE, type: 'text/html; charset=utf-8' },
  }
) {
  return { ASSETS: assetsWith(files) } as Env & {
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

/** The site's own miss: its 404 page, uncacheable. */
async function expectSiteMiss(res: Response) {
  expect(res.status).toBe(404)
  expect(res.headers.get('cache-control')).toBe('no-store')
  expect(await res.text()).toBe(NOT_FOUND_PAGE)
}

describe("a missing FILE is the site's 404, not the shell", () => {
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
      await expectSiteMiss(await worker.fetch(req(path), envWith()))
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

/** A Play screen, the addresses that redirect into one and the link-preview surface draw no Union bar, from the first paint. */
describe('a route that draws no Union bar', () => {
  for (const path of ['/play/abc', '/dashboard/abc', '/mediator/g1', '/og/pilot/abc']) {
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
 * One shell answers every route, rendered on Build's front door; the Worker
 * marks its Union bar for the route it serves, so the mode, tab and nav item
 * are right from the first paint and Play never flashes Build's.
 */
describe('the shell’s Union bar is marked for the route', () => {
  const BAR_SHELL = `<!doctype html><html lang="en"><body>${renderUnionBar()}</body></html>`
  const served = async (path: string) => {
    const env = envWith({ [`${BASE}${path}`]: { body: BAR_SHELL, type: 'text/html' } })
    const res = await worker.fetch(navigateTo(`https://salvageunion.io${BASE}${path}`), env)
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html')
    return {
      mode: doc.querySelector('.su-union-bar')?.getAttribute('data-mode'),
      current: Array.from(doc.querySelectorAll('[aria-current]')).map((el) => el.textContent),
      hidden: doc.documentElement.hasAttribute('data-union-bar-hidden'),
    }
  }

  it('wears Play on Play’s hub, Play’s tab current', async () => {
    expect(await served('/play/')).toEqual({ mode: 'play', current: ['Play'], hidden: false })
  })

  it('wears Build on Build’s pages, the page’s nav link current', async () => {
    expect(await served('/mechs/patterns/')).toEqual({
      mode: 'build',
      current: ['Build', 'Patterns'],
      hidden: false,
    })
    expect(await served('/')).toEqual({
      mode: 'build',
      current: ['Build', 'Hangar'],
      hidden: false,
    })
  })

  it('marks, and hides, a Cockpit’s', async () => {
    expect(await served('/play/game/g1')).toEqual({ mode: 'play', current: ['Play'], hidden: true })
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
 * The app keeps no About or Changelog of its own: both tools share the SRD's, so
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

  it("a Worker Preview's go to its own SRD: the request's origin", async () => {
    const srd = 'https://pr-1-su-srd.example.workers.dev'
    const env = envWith()
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

describe('the bare base', () => {
  it("301s to the base's directory, query kept", async () => {
    for (const url of ['https://salvageunion.io/build', 'https://salvageunion.io/build?x=1']) {
      const res = await worker.fetch(navigateTo(url), envWith())
      expect(res.status).toBe(301)
      expect(res.headers.get('location')).toBe(`${BASE}/${new URL(url).search}`)
    }
  })
})

describe('the deploy', () => {
  it("sets Convex Auth's SITE_URL to where the app is served, on every deploy", async () => {
    const workflow = await Bun.file(
      new URL('../../../../../.github/workflows/deploy-cloudflare.yml', import.meta.url)
    ).text()
    const siteUrlEnv = workflow.match(/^\s*APP_URL:\s*(\S+)\s*$/m)?.[1]
    expect(siteUrlEnv).toBe(appUrl('', originOf()))
    expect(workflow).toContain('bunx convex env set SITE_URL "$APP_URL"')
  })
})
