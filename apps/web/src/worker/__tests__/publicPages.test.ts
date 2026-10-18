import { afterEach, describe, expect, it } from 'bun:test'
import { STARTER_CRAWLERS, STARTER_MECHS, STARTER_PILOTS } from 'game-domain/starterSet/starterSet'
import { NATIVE_FETCH_GLOBALS } from '../../../test/env'
import { color } from '../../design/tokens'
import { renderShell } from '../../shell/shell'
import type { Env } from '../index'
import worker from '../index'
import { publicShells, sitemapXml } from '../publicPages'

/**
 * The public pages (the front door, the Starter Set and each of its builds).
 * The build pre-renders the Starter Set's and each build's shell with the
 * page's own title, description, canonical and `og:*`, named for the
 * deployment's origin, and `sitemap.xml` with exactly those pages. The front
 * door is the shell itself: a crawler's request for it gets its canonical from
 * the Worker. Nothing here asks Convex.
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
    CONVEX_URL: 'https://convex.example',
  } as Env & { asked: string[] }
}

/** A crawler: no `Sec-Fetch-Mode`. */
const crawl = (path: string, origin = PROD) => new Request(`${origin}${BASE}${path}`)

/** A page's pre-rendered shell by its path inside the app, as the build writes it. */
function shellFor(path: string, origin = PROD): string {
  const file = `${path.slice(1)}.html`
  const page = publicShells(SHELL, origin, BASE).find((shell) => shell.file === file)
  if (!page) throw new Error(`no pre-rendered shell for ${path}`)
  return page.html
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

describe('a Starter Set build’s pre-rendered shell', () => {
  const path = '/starter/pilot/starter-pilot-bonesaw'

  it('carries the build’s own title, description and canonical', () => {
    const html = shellFor(path)
    expect(title(html)).toBe('Bonesaw · Starter Set Pilot · SalvageUnion.io')
    expect(meta(html, 'og:title')).toBe('Bonesaw · Starter Set Pilot · SalvageUnion.io')
    expect(meta(html, 'description')).toStartWith(
      'Bonesaw, a pre-generated Pilot from the Salvage Union Starter Set'
    )
    expect(meta(html, 'og:description')).toBe(meta(html, 'description'))
    expect(canonical(html)).toEqual([`${PROD}${BASE}${path}`])
    expect(meta(html, 'og:url')).toBe(`${PROD}${BASE}${path}`)
    expect(meta(html, 'theme-color')).toBe(color.pilot)
  })

  it("unfurls with the site's own picture: the render surfaces read Convex, which has no template", () => {
    const html = shellFor(path)
    expect(meta(html, 'og:image')).toBe(`${PROD}/og-image.png`)
    expect(meta(html, 'twitter:card')).toBe('summary_large_image')
  })

  it('wears each kind’s tone', () => {
    expect(meta(shellFor(`/starter/mech/${STARTER_MECHS[0]?.id}`), 'theme-color')).toBe(color.mech)
    expect(meta(shellFor(`/starter/crawler/${STARTER_CRAWLERS[0]?.id}`), 'theme-color')).toBe(
      color.crawlerBand
    )
  })

  it("follows the deployment's origin: a Preview's canonical is the Preview's", () => {
    const html = shellFor(path, PREVIEW)
    expect(canonical(html)).toEqual([`${PREVIEW}${BASE}${path}`])
    expect(meta(html, 'og:image')).toBe(`${PREVIEW}/og-image.png`)
  })

  it('names the crawler by its own name', () => {
    const html = shellFor(`/starter/crawler/${STARTER_CRAWLERS[0]?.id}`)
    expect(title(html)).toBe(
      "Crawler #430 'Tenacity' · Starter Set Union Crawler · SalvageUnion.io"
    )
  })

  it('is the shell with only its meta block and title changed', () => {
    const strip = (html: string) =>
      html
        .replace(/<!-- app:meta:start -->[\s\S]*<!-- app:meta:end -->/, '')
        .replace(/<title>[^<]*<\/title>/, '')
    expect(strip(shellFor(path))).toBe(strip(SHELL))
  })
})

describe('the Starter Set’s pre-rendered shell, and the front door', () => {
  it('gives the Starter Set its own title and canonical', () => {
    const html = shellFor('/starter')
    expect(title(html)).toBe('Starter Set · SalvageUnion.io')
    expect(meta(html, 'description')).toContain('Reclamation of the Wastes')
    expect(canonical(html)).toEqual([`${PROD}${BASE}/starter`])
  })

  it('writes one shell per page, at its route plus `.html`', () => {
    expect(publicShells(SHELL, PROD, BASE).map((shell) => shell.file)).toEqual([
      'starter.html',
      ...STARTER_PILOTS.map((t) => `starter/pilot/${t.id}.html`),
      ...STARTER_MECHS.map((t) => `starter/mech/${t.id}.html`),
      ...STARTER_CRAWLERS.map((t) => `starter/crawler/${t.id}.html`),
    ])
  })

  it("keeps the front door's defaults and adds its canonical, inside the meta block", async () => {
    const res = await worker.fetch(crawl('/'), env())
    const html = await res.text()
    expect(title(html)).toBe('The Cantina · SalvageUnion.io')
    expect(meta(html, 'og:image')).toBe(`${PROD}/og-image.png`)
    expect(canonical(html)).toEqual([`${PROD}${BASE}/`])
    expect(html.indexOf('rel="canonical"')).toBeLessThan(html.indexOf('<!-- app:meta:end -->'))
    expect(html.replace(/<link rel="canonical"[^>]*>\n\s*/, '')).toBe(SHELL)
    // Indexable, and the shell's own headers kept.
    expect(res.headers.get('x-robots-tag')).toBeNull()
    expect(res.headers.get('content-type')).toBe('text/html')
    expect(fetched).toEqual([])
  })

  it("names a Preview's front door on the Preview", async () => {
    const html = await (await worker.fetch(crawl('/', PREVIEW), env())).text()
    expect(canonical(html)).toEqual([`${PREVIEW}${BASE}/`])
  })

  it('reads the front door’s shell from the base’s directory', async () => {
    const e = env()
    await worker.fetch(crawl('/'), e)
    expect(e.asked).toEqual([`${BASE}/`])
  })

  it('leaves a navigation to the front door to the asset server', async () => {
    const e = env()
    const res = await worker.fetch(
      new Request(`${PROD}${BASE}/`, { headers: { 'sec-fetch-mode': 'navigate' } }),
      e
    )
    expect(await res.text()).toBe(SHELL)
  })

  it('leaves a public page’s crawl to the asset server, which answers its file', async () => {
    const e = env()
    await worker.fetch(crawl('/starter/pilot/starter-pilot-bonesaw'), e)
    expect(e.asked).toEqual([`${BASE}/starter/pilot/starter-pilot-bonesaw`])
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

describe('sitemap.xml', () => {
  const locs = (origin = PROD) =>
    [...sitemapXml(origin, BASE).matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1] ?? '')

  it('lists the front door, the Starter Set and every build, and nothing else', () => {
    expect(sitemapXml(PROD, BASE)).toStartWith('<?xml version="1.0" encoding="UTF-8"?><urlset ')
    const builds = [
      ...STARTER_PILOTS.map((t) => `/starter/pilot/${t.id}`),
      ...STARTER_MECHS.map((t) => `/starter/mech/${t.id}`),
      ...STARTER_CRAWLERS.map((t) => `/starter/crawler/${t.id}`),
    ]
    expect(locs()).toEqual([
      `${PROD}${BASE}/`,
      `${PROD}${BASE}/starter`,
      ...builds.map((p) => `${PROD}${BASE}${p}`),
    ])
  })

  it('lists each page at the canonical its shell names', () => {
    for (const loc of locs().slice(1)) {
      expect(canonical(shellFor(new URL(loc).pathname.slice(BASE.length)))).toEqual([loc])
    }
  })

  it("names a Preview's pages on the Preview", () => {
    expect(locs(PREVIEW).every((loc) => loc.startsWith(`${PREVIEW}${BASE}/`))).toBe(true)
  })

  it('is a file the asset server answers, not one the Worker makes', async () => {
    const e = env()
    await worker.fetch(crawl('/sitemap.xml'), e)
    expect(e.asked[0]).toBe(`${BASE}/sitemap.xml`)
  })
})
