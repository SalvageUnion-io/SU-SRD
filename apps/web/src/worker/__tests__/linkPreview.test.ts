import { afterEach, describe, expect, it } from 'bun:test'
import { color } from '../../design/tokens'
import { META_END, META_START } from '../../lib/documentHead'
import { renderShell } from '../../shell/shell'
import type { Env } from '../index'
import worker from '../index'
import type { ImageCache } from '../linkPreview'
import { ogImage, previewRouteOf, versionOf } from '../linkPreview'
import { applyMeta } from '../shellMeta'

/**
 * Link previews for player things. Discord's unfurler
 * (`Discordbot/2.0`) asks for a shared route without a navigation, so the
 * Worker answers it, and must write that thing's preview into the shell —
 * and for a private thing, nothing about it at all.
 */

/** The real shell, so a test fails if it loses its markers. */
const SHELL = renderShell()

const CONVEX_URL = 'https://convex.example'

/** What the fake Convex answers, by function path then by a key of its args. */
type Answers = Record<string, Record<string, unknown>>

const PATTERN = {
  kind: 'pattern',
  body: { id: 'pat-1', name: 'Tow Rig', chassisRef: 'scrapper', systems: [], modules: [] },
  ownerName: 'alxjrvs',
  gameName: null,
}

/** A Component Embed as Convex answers it, with a `<` a player could type. */
const EMBED = JSON.stringify({
  component: { type: 17, components: [{ type: 10, content: '## Tow <Rig>' }] },
})

const PILOT = {
  kind: 'pilot',
  body: { id: 'p-1', name: 'Rosa Vance', callsign: 'Bonesaw', classRef: 'engineer' },
  ownerName: 'Rosa',
  gameName: 'Reclamation of the Wastes',
}

const INVITE = {
  gameName: 'Reclamation of the Wastes',
  mediatedBy: 'alxjrvs',
}

const ANSWERS: Answers = {
  'publicSheet:preview': {
    // Asked with the app's address, a pattern's answer carries its Discord card.
    'pattern/pat-1': { ...PATTERN, componentEmbed: EMBED },
    'pilot/p-1': PILOT,
    // p-2 exists but is private: Convex answers it with null, as for a missing one.
    'pilot/p-2': null,
  },
  'publicSheet:invitePreview': { K7QR2XA: INVITE },
}

/** Every request the fake network saw. */
let seen: { url: string; body: unknown }[] = []

function fakeFetch(answers: Answers = ANSWERS, png = true) {
  seen = []
  return async (input: Request | string, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.url
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    seen.push({ url, body })
    if (url.startsWith(CONVEX_URL)) {
      const { path, args } = body as { path: string; args: Record<string, string> }
      const key = args.code ?? `${args.kind}/${args.appId}`
      const value = answers[path]?.[key] ?? null
      return Response.json({ status: 'success', value })
    }
    if (url.includes('/browser-rendering/screenshot')) {
      return png
        ? new Response(new Uint8Array([137, 80, 78, 71]), {
            headers: { 'content-type': 'image/png' },
          })
        : new Response('nope', { status: 500 })
    }
    return new Response('unexpected', { status: 599 })
  }
}

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

function env(over: Partial<Env> = {}): Env {
  return {
    ASSETS: {
      async fetch() {
        return new Response(SHELL, { headers: { 'content-type': 'text/html' } })
      },
    },
    CONVEX_URL,
    CF_ACCOUNT_ID: 'acct',
    BROWSER_RENDERING_TOKEN: 'token',
    ...over,
  } as Env
}

/** Discord's unfurler: no Sec-Fetch-Mode, so the request reaches the Worker. */
const discordbot = (path: string) =>
  new Request(`https://salvageunion.io/build${path}`, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)' },
  })

async function unfurl(path: string, e: Env = env()): Promise<string> {
  return (await crawl(path, e)).text()
}

async function crawl(path: string, e: Env = env()): Promise<Response> {
  globalThis.fetch = fakeFetch() as typeof fetch
  const res = await worker.fetch(discordbot(path), e)
  expect(res.status).toBe(200)
  return res
}

function meta(html: string, key: string): string | undefined {
  const match = new RegExp(`<meta[^>]*(?:name|property)="${key}"[^>]*content="([^"]*)"`).exec(html)
  return match?.[1]
}

describe('the shell carries its markers', () => {
  it('wraps the sitewide defaults in app:meta', () => {
    expect(SHELL.indexOf(META_START)).toBeGreaterThan(-1)
    expect(SHELL.indexOf(META_END)).toBeGreaterThan(SHELL.indexOf(META_START))
    // The theme-color is inside the block, so a preview can retone it.
    const block = SHELL.slice(SHELL.indexOf(META_START), SHELL.indexOf(META_END))
    expect(block).toContain('theme-color')
  })
})

describe('a Discordbot fetch of a shared pattern', () => {
  it('unfurls as the pattern: name, kicker and "Made by", the mech tone, its card', async () => {
    const html = await unfurl('/p/pattern/pat-1')
    expect(meta(html, 'og:title')).toBe('Tow Rig')
    expect(meta(html, 'og:description')).toBe('Mech Pattern · Scrapper · Made by alxjrvs')
    expect(meta(html, 'theme-color')).toBe(color.mech)
    expect(meta(html, 'og:url')).toBe('https://salvageunion.io/build/p/pattern/pat-1')
    expect(meta(html, 'og:image')).toBe(
      `https://salvageunion.io/build/og/pattern/pat-1.png?v=${versionOf(PATTERN)}`
    )
    expect(meta(html, 'twitter:card')).toBe('summary_large_image')
    expect(html).toContain('<title>Tow Rig</title>')
    // The defaults are replaced, not joined.
    expect(html.match(/property="og:title"/g)).toHaveLength(1)
  })
})

describe("a shared pattern's Discord card", () => {
  it('carries its Component Embed, as a book pattern page does, script-escaped', async () => {
    const html = await unfurl('/p/pattern/pat-1')
    const asked = seen.find(
      (r) => (r.body as { path?: string } | undefined)?.path === 'publicSheet:preview'
    )
    expect((asked?.body as { args: unknown } | undefined)?.args).toEqual({
      kind: 'pattern',
      appId: 'pat-1',
      appUrl: 'https://salvageunion.io/build',
    })
    const block = html.slice(html.indexOf(META_START), html.indexOf(META_END))
    expect(block).toContain('<script id="discord:component-embed" type="application/json">')
    expect(block).toContain('## Tow \\u003cRig>')
    expect(block).not.toContain('Tow <Rig>')
    // The picture is versioned by what it draws, which the card is not part of.
    expect(meta(html, 'og:image')).toBe(
      `https://salvageunion.io/build/og/pattern/pat-1.png?v=${versionOf(PATTERN)}`
    )
  })

  it('a private pattern, or a sheet, carries none', async () => {
    globalThis.fetch = fakeFetch({
      ...ANSWERS,
      'publicSheet:preview': { 'pattern/pat-1': null },
    }) as typeof fetch
    const res = await worker.fetch(discordbot('/p/pattern/pat-1'), env())
    expect(await res.text()).not.toContain('discord:component-embed')
    expect(await unfurl('/p/pilot/p-1')).not.toContain('discord:component-embed')
  })
})

describe('a Discordbot fetch of a pilot sheet', () => {
  it('unfurls as the pilot: callsign, class, player and Game, the pilot tone', async () => {
    const html = await unfurl('/p/pilot/p-1')
    expect(meta(html, 'og:title')).toBe('Bonesaw')
    expect(meta(html, 'og:description')).toBe(
      "Pilot · Engineer · Rosa's pilot · Reclamation of the Wastes"
    )
    expect(meta(html, 'theme-color')).toBe(color.pilot)
    expect(meta(html, 'og:image')).toStartWith('https://salvageunion.io/build/og/pilot/p-1.png?v=')
  })
})

describe('search and a shared sheet', () => {
  it('lists a public sheet at its one address', async () => {
    const res = await crawl('/p/pilot/p-1')
    expect(res.headers.get('x-robots-tag')).toBeNull()
    expect(await res.text()).toContain(
      '<link rel="canonical" href="https://salvageunion.io/build/p/pilot/p-1" />'
    )
  })

  it('never lists a private or missing one', async () => {
    for (const path of ['/p/pilot/p-2', '/p/pilot/nobody']) {
      const res = await crawl(path)
      expect(res.headers.get('x-robots-tag')).toBe('noindex')
      expect(await res.text()).not.toContain('rel="canonical"')
    }
  })
})

describe('a name with a $ in it', () => {
  it.each(['$&', "$'", '$`', '$$', 'Cash $1'])('is written literally: %p', (name) => {
    const html = applyMeta(SHELL, {
      title: name,
      description: 'Pilot',
      url: 'https://salvageunion.io/build/p/pilot/p-1',
      themeColor: color.pilot,
    })
    const escaped = name.replace(/&/g, '&amp;')
    expect(html).toContain(`<title>${escaped}</title>`)
    expect(html.match(/<title>/g)).toHaveLength(1)
    // The head is intact: the meta block still sits inside it.
    expect(html.indexOf(META_END)).toBeLessThan(html.indexOf('</head>'))
    expect(html.indexOf('</head>')).toBeLessThan(html.indexOf('<body'))
    expect(meta(html, 'og:title')).toBe(escaped)
  })
})

describe('a Discordbot fetch of a private sheet', () => {
  it('unfurls as the plain Private card and leaks nothing', async () => {
    const html = await unfurl('/p/pilot/p-2')
    expect(meta(html, 'og:title')).toBe('Private')
    expect(meta(html, 'og:description')).toBe("Its owner hasn't shared this.")
    expect(meta(html, 'theme-color')).toBe(color.inkDeep)
    // One picture for every private thing: the URL does not carry the id.
    expect(meta(html, 'og:image')).toBe('https://salvageunion.io/build/og/private.png?v=1')
    // Nothing but the address the link already is: no kind, no maker, no Game.
    const block = html.slice(html.indexOf(META_START), html.indexOf(META_END))
    expect(block.replace('https://salvageunion.io/build/p/pilot/p-2', '')).not.toContain('p-2')
    expect(block).not.toContain('Pilot ·')
    expect(block).not.toContain('Made by')
  })
})

describe('a Discordbot fetch of an invite', () => {
  it('unfurls the /invite/<token> link the app and the bot hand out', async () => {
    const html = await unfurl('/invite/K7QR2XA')
    expect(meta(html, 'og:title')).toBe('Reclamation of the Wastes')
    expect(meta(html, 'og:description')).toBe("You're invited · Player seat · Mediated by alxjrvs.")
    expect(meta(html, 'og:title')).not.toContain('K7QR2XA')
    expect(meta(html, 'og:description')).not.toContain('K7QR2XA')
    expect(meta(html, 'og:url')).toBe('https://salvageunion.io/build/invite/K7QR2XA')
    expect(meta(html, 'theme-color')).toBe(color.crawlerBand)
    expect(html).toContain('<title>Reclamation of the Wastes</title>')
  })

  it('sends an old /join/<code> link to /invite/<code> before unfurling, so the bot unfurls that', async () => {
    // Where intheunionnow.com's zone Redirect Rule sends an old link.
    const old = new Request('https://salvageunion.io/build/join/K7QR2XA', {
      headers: { 'user-agent': 'Discordbot/2.0' },
    })
    const res = await worker.fetch(old, env())
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('/build/invite/K7QR2XA')
  })

  it('keeps the sitewide defaults for a dead code', async () => {
    expect(meta(await unfurl('/invite/DEADCODE'), 'og:title')).toBe(
      'Training Bay · SalvageUnion.io'
    )
  })
})

describe('without a renderer', () => {
  it('advertises no image, so the unfurl is text', async () => {
    const html = await unfurl('/p/pattern/pat-1', env({ BROWSER_RENDERING_TOKEN: undefined }))
    expect(meta(html, 'og:title')).toBe('Tow Rig')
    expect(meta(html, 'og:image')).toBeUndefined()
    expect(meta(html, 'twitter:card')).toBe('summary')
  })
})

describe('when Convex does not answer', () => {
  it('keeps the sitewide defaults rather than breaking the page', async () => {
    globalThis.fetch = (async () =>
      new Response('down', { status: 503 })) as unknown as typeof fetch
    const res = await worker.fetch(discordbot('/p/pilot/p-1'), env())
    expect(res.status).toBe(200)
    expect(meta(await res.text(), 'og:title')).toBe('Training Bay · SalvageUnion.io')
  })
})

describe('previewRouteOf', () => {
  it('reads the routes a player shares, and nothing else', () => {
    expect(previewRouteOf('/p/pilot/abc')).toEqual({ type: 'sheet', kind: 'pilot', id: 'abc' })
    expect(previewRouteOf('/p/pattern/abc')).toEqual({ type: 'sheet', kind: 'pattern', id: 'abc' })
    expect(previewRouteOf('/p/npc/abc')).toEqual({ type: 'sheet', kind: 'npc', id: 'abc' })
    expect(previewRouteOf('/invite/0123456789ABCDEF')).toEqual({
      type: 'invite',
      code: '0123456789ABCDEF',
    })
    expect(previewRouteOf('/join/K7QR2XA')).toBeNull()
    expect(previewRouteOf('/invite')).toBeNull()
    expect(previewRouteOf('/p/encounter/abc')).toBeNull()
    expect(previewRouteOf('/sheet/pilot/abc')).toBeNull()
    expect(previewRouteOf('/p/pilot/<script>')).toBeNull()
  })
})

/** An in-memory Cache API. */
function memoryCache(): ImageCache & { keys: string[] } {
  const store = new Map<string, Response>()
  return {
    keys: [],
    async match(key) {
      return store.get(key.url)?.clone()
    },
    async put(key, response) {
      this.keys.push(key.url)
      store.set(key.url, response)
    },
  }
}

const imageRequest = (path: string) => new Request(`https://salvageunion.io/build${path}`)

describe('the picture route', () => {
  it('renders the current version once, then serves it from the cache', async () => {
    const cache = memoryCache()
    const fetchImpl = fakeFetch()
    const first = await ogImage(imageRequest('/og/pattern/pat-1.png?v=stale'), env(), {
      base: '/build',
      cache,
      fetch: fetchImpl,
    })
    expect(first.status).toBe(200)
    expect(first.headers.get('content-type')).toBe('image/png')
    // Keyed by the CURRENT version, whatever `v` the URL carried.
    expect(cache.keys).toEqual([
      `https://salvageunion.io/build/og/pattern/pat-1.png?v=${versionOf(PATTERN)}`,
    ])
    const shot = seen.find((r) => r.url.includes('/browser-rendering/screenshot'))
    expect(shot?.body).toMatchObject({
      url: 'https://salvageunion.io/build/og/pattern/pat-1',
      viewport: { width: 1200, height: 630 },
    })

    const again = await ogImage(imageRequest('/og/pattern/pat-1.png'), env(), {
      base: '/build',
      cache,
      fetch: fakeFetch(),
    })
    expect(again.status).toBe(200)
    expect(seen.some((r) => r.url.includes('/browser-rendering/screenshot'))).toBe(false)
  })

  it('an edit is a new version, so a new render', async () => {
    const cache = memoryCache()
    await ogImage(imageRequest('/og/pattern/pat-1.png'), env(), {
      base: '/build',
      cache,
      fetch: fakeFetch(),
    })
    const edited = {
      ...ANSWERS,
      'publicSheet:preview': {
        'pattern/pat-1': { ...PATTERN, body: { ...PATTERN.body, name: 'Tow Rig II' } },
      },
    }
    await ogImage(imageRequest('/og/pattern/pat-1.png'), env(), {
      base: '/build',
      cache,
      fetch: fakeFetch(edited),
    })
    expect(cache.keys).toHaveLength(2)
  })

  it('a thing made private gets the private card, never its old picture', async () => {
    const cache = memoryCache()
    await ogImage(imageRequest('/og/pattern/pat-1.png'), env(), {
      base: '/build',
      cache,
      fetch: fakeFetch(),
    })
    const madePrivate = { ...ANSWERS, 'publicSheet:preview': { 'pattern/pat-1': null } }
    const res = await ogImage(imageRequest('/og/pattern/pat-1.png'), env(), {
      base: '/build',
      cache,
      fetch: fakeFetch(madePrivate),
    })
    expect(res.status).toBe(200)
    const shot = seen.find((r) => r.url.includes('/browser-rendering/screenshot'))
    expect(shot?.body).toMatchObject({ url: 'https://salvageunion.io/build/og/private' })
  })

  it('past the render cap a fresh render 404s, and a cached picture is never counted', async () => {
    const cache = memoryCache()
    const keys: string[] = []
    let allow = true
    const OG_RENDER_LIMIT = {
      async limit({ key }: { key: string }) {
        keys.push(key)
        return { success: allow }
      },
    }
    await ogImage(imageRequest('/og/pattern/pat-1.png'), env({ OG_RENDER_LIMIT }), {
      base: '/build',
      cache,
      fetch: fakeFetch(),
    })
    allow = false
    const cached = await ogImage(imageRequest('/og/pattern/pat-1.png'), env({ OG_RENDER_LIMIT }), {
      base: '/build',
      cache,
      fetch: fakeFetch(),
    })
    expect(cached.status).toBe(200)
    expect(keys).toEqual(['og-render'])

    const capped = await ogImage(imageRequest('/og/pilot/p-1.png'), env({ OG_RENDER_LIMIT }), {
      base: '/build',
      cache,
      fetch: fakeFetch(),
    })
    expect(capped.status).toBe(404)
    expect(capped.headers.get('cache-control')).toBe('no-store')
    expect(seen.some((r) => r.url.includes('/browser-rendering/screenshot'))).toBe(false)
  })

  it('404s without a renderer, a dead invite, or a failed render', async () => {
    const cache = memoryCache()
    const noToken = await ogImage(
      imageRequest('/og/pattern/pat-1.png'),
      env({ BROWSER_RENDERING_TOKEN: undefined }),
      { base: '/build', cache, fetch: fakeFetch() }
    )
    expect(noToken.status).toBe(404)
    const dead = await ogImage(imageRequest('/og/invite/DEADCODE.png'), env(), {
      base: '/build',
      cache,
      fetch: fakeFetch(),
    })
    expect(dead.status).toBe(404)
    const failed = await ogImage(imageRequest('/og/pilot/p-1.png'), env(), {
      base: '/build',
      cache,
      fetch: fakeFetch(ANSWERS, false),
    })
    expect(failed.status).toBe(404)
    expect(failed.headers.get('cache-control')).toBe('no-store')
    expect(cache.keys).toEqual([])
  })

  it('is reached through the Worker ahead of the missing-file rule', async () => {
    globalThis.fetch = fakeFetch() as typeof fetch
    const res = await worker.fetch(imageRequest('/og/private.png?v=1'), env())
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
  })
})
