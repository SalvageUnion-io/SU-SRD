import { afterEach, describe, expect, it } from 'bun:test'
import {
  STARTER_CRAWLERS,
  STARTER_MECHS,
  STARTER_PILOTS,
} from 'cantina-domain/starterSet/starterSet'
import { color } from 'component-lib/design/tokens'
import { NATIVE_FETCH_GLOBALS } from '../../../../test/env'
import { renderShell } from '../../shell/shell'
import type { Env } from '../index'
import worker from '../index'

/**
 * The public pages (the front door, the Starter Set and each of its builds):
 * a crawler's request gets the shell with the page's own title, description,
 * canonical and `og:*`, built from the request's origin, and `/sitemap.xml`
 * lists exactly those pages. Nothing here asks Convex.
 */

/** The real shell, so a test fails if it loses its markers. */
const SHELL = renderShell()

const BASE = '/build'
const PROD = 'https://salvageunion.io'
const PREVIEW = 'https://pr-7-su-srd.example.workers.dev'

/** The runtime's own `Request`, which keeps `Sec-Fetch-*` (see routing.test.ts). */
const { Request } = NATIVE_FETCH_GLOBALS

const realFetch = globalThis.fetch
let fetched: string[] = []
afterEach(() => {
  globalThis.fetch = realFetch
})

function env(): Env & { asked: string[] } {
  const asked: string[] = []
  fetched = []
  globalThis.fetch = (async (input: Request | string) => {
    fetched.push(typeof input === 'string' ? input : input.url)
    return new Response('unexpected', { status: 599 })
  }) as typeof fetch
  return {
    asked,
    ASSETS: {
      async fetch(request: Request) {
        asked.push(new URL(request.url).pathname)
        return new Response(SHELL, { headers: { 'content-type': 'text/html', etag: '"shell"' } })
      },
    },
    BASE_PATH: BASE,
    CONVEX_URL: 'https://convex.example',
  } as Env & { asked: string[] }
}

/** A crawler: no `Sec-Fetch-Mode`. */
const crawl = (path: string, origin = PROD) => new Request(`${origin}${BASE}${path}`)

async function crawled(path: string, origin = PROD): Promise<{ html: string; res: Response }> {
  const res = await worker.fetch(crawl(path, origin), env())
  expect(res.status).toBe(200)
  return { html: await res.text(), res }
}

function meta(html: string, key: string): string | undefined {
  const match = new RegExp(`<meta[^>]*(?:name|property)="${key}"[^>]*content="([^"]*)"`).exec(html)
  return match?.[1]
}

function canonical(html: string): string[] {
  return [...html.matchAll(/<link rel="canonical" href="([^"]*)"/g)].map((m) => m[1] ?? '')
}

function title(html: string): string | undefined {
  return /<title>([^<]*)<\/title>/.exec(html)?.[1]
}

describe("a crawler's fetch of a Starter Set build", () => {
  const path = '/starter/pilot/starter-pilot-bonesaw'

  it('carries the build’s own title, description and canonical', async () => {
    const { html, res } = await crawled(path)
    expect(title(html)).toBe('Bonesaw · Starter Set Pilot · The Cantina')
    expect(meta(html, 'og:title')).toBe('Bonesaw · Starter Set Pilot · The Cantina')
    expect(meta(html, 'description')).toStartWith(
      'Bonesaw, a pre-generated Pilot from the Salvage Union Starter Set'
    )
    expect(meta(html, 'og:description')).toBe(meta(html, 'description'))
    expect(canonical(html)).toEqual([`${PROD}${BASE}${path}`])
    expect(meta(html, 'og:url')).toBe(`${PROD}${BASE}${path}`)
    expect(meta(html, 'theme-color')).toBe(color.pilot)
    // Indexable, and the shell's own headers kept.
    expect(res.headers.get('x-robots-tag')).toBeNull()
    expect(res.headers.get('content-type')).toBe('text/html')
  })

  it("unfurls with the app's own picture: the render surfaces read Convex, which has no template", async () => {
    const { html } = await crawled(path)
    expect(meta(html, 'og:image')).toBe(`${PROD}${BASE}/og-image.png`)
    expect(meta(html, 'twitter:card')).toBe('summary_large_image')
    expect(fetched).toEqual([])
  })

  it('wears each kind’s tone', async () => {
    const mech = STARTER_MECHS[0]
    const crawler = STARTER_CRAWLERS[0]
    expect(meta((await crawled(`/starter/mech/${mech?.id}`)).html, 'theme-color')).toBe(color.mech)
    expect(meta((await crawled(`/starter/crawler/${crawler?.id}`)).html, 'theme-color')).toBe(
      color.crawlerBand
    )
  })

  it('names one canonical for the page with or without a trailing slash', async () => {
    const { html } = await crawled(`${path}/`)
    expect(canonical(html)).toEqual([`${PROD}${BASE}${path}`])
  })

  it("follows the origin it is served from: a Preview's canonical is the Preview's", async () => {
    const { html } = await crawled(path, PREVIEW)
    expect(canonical(html)).toEqual([`${PREVIEW}${BASE}${path}`])
    expect(meta(html, 'og:image')).toBe(`${PREVIEW}${BASE}/og-image.png`)
  })

  it('names the crawler by its own name', async () => {
    const crawler = STARTER_CRAWLERS[0]
    const { html } = await crawled(`/starter/crawler/${crawler?.id}`)
    expect(title(html)).toBe("Crawler #430 'Tenacity' · Starter Set Union Crawler · The Cantina")
  })

  it('keeps the defaults, without a canonical, for a build the Starter Set does not hold', async () => {
    for (const miss of ['/starter/pilot/nobody', '/starter/npc/starter-pilot-bonesaw']) {
      const { html } = await crawled(miss)
      expect(html).toBe(SHELL)
    }
  })

  it('leaves a navigation to the asset server: the client sets its own title', async () => {
    const e = env()
    const res = await worker.fetch(
      new Request(`${PROD}${BASE}${path}`, { headers: { 'sec-fetch-mode': 'navigate' } }),
      e
    )
    expect(await res.text()).toBe(SHELL)
    expect(e.asked).toEqual([`${BASE}${path}`])
  })
})

describe("a crawler's fetch of the Starter Set and the front door", () => {
  it('gives the Starter Set its own title and canonical', async () => {
    const { html } = await crawled('/starter')
    expect(title(html)).toBe('Starter Set · The Cantina')
    expect(meta(html, 'description')).toContain('Reclamation of the Wastes')
    expect(canonical(html)).toEqual([`${PROD}${BASE}/starter`])
    expect(canonical((await crawled('/starter/')).html)).toEqual([`${PROD}${BASE}/starter`])
  })

  it("keeps the front door's defaults and adds its canonical, inside the meta block", async () => {
    const { html } = await crawled('/')
    expect(title(html)).toBe('The Cantina')
    expect(meta(html, 'og:image')).toBe(`${PROD}${BASE}/og-image.png`)
    expect(canonical(html)).toEqual([`${PROD}${BASE}/`])
    expect(html.indexOf('rel="canonical"')).toBeLessThan(html.indexOf('<!-- cantina:meta:end -->'))
    expect(html.replace(/<link rel="canonical"[^>]*>\n\s*/, '')).toBe(SHELL)
  })

  it("names a Preview's front door on the Preview", async () => {
    expect(canonical((await crawled('/', PREVIEW)).html)).toEqual([`${PREVIEW}${BASE}/`])
  })

  it('reads the shell from the base’s directory', async () => {
    const e = env()
    await worker.fetch(crawl('/starter/pilot/starter-pilot-bonesaw'), e)
    expect(e.asked).toEqual([`${BASE}/`])
  })
})

describe('a private or signed-in route gets no canonical', () => {
  for (const path of ['/sheet/pilot/xyz', '/games/g1', '/pilots/new', '/settings']) {
    it(`leaves ${path} as the shell, noindex`, async () => {
      const res = await worker.fetch(crawl(path), env())
      expect(await res.text()).toBe(SHELL)
      expect(res.headers.get('x-robots-tag')).toBe('noindex')
    })
  }
})

describe('/sitemap.xml', () => {
  async function sitemap(origin = PROD) {
    const e = env()
    const res = await worker.fetch(crawl('/sitemap.xml', origin), e)
    const body = await res.text()
    const locs = [...body.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1] ?? '')
    return { res, body, locs, asked: e.asked }
  }

  it('lists the front door, the Starter Set and every build, and nothing else', async () => {
    const { res, body, locs, asked } = await sitemap()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/xml; charset=utf-8')
    expect(body).toStartWith('<?xml version="1.0" encoding="UTF-8"?><urlset ')
    const builds = [
      ...STARTER_PILOTS.map((t) => `/starter/pilot/${t.id}`),
      ...STARTER_MECHS.map((t) => `/starter/mech/${t.id}`),
      ...STARTER_CRAWLERS.map((t) => `/starter/crawler/${t.id}`),
    ]
    expect(locs).toEqual([
      `${PROD}${BASE}/`,
      `${PROD}${BASE}/starter`,
      ...builds.map((p) => `${PROD}${BASE}${p}`),
    ])
    // Made here: the asset binding is never asked.
    expect(asked).toEqual([])
  })

  it('lists each page at the canonical its shell names', async () => {
    const { locs } = await sitemap()
    for (const loc of locs) {
      const { html } = await crawled(new URL(loc).pathname.slice(BASE.length))
      expect(canonical(html)).toEqual([loc])
    }
  })

  it("names a Preview's pages on the Preview", async () => {
    const { locs } = await sitemap(PREVIEW)
    expect(locs.every((loc) => loc.startsWith(`${PREVIEW}${BASE}/`))).toBe(true)
  })
})
