import { afterEach, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { color } from 'component-lib/design/tokens'
import type { Env } from '../index'
import worker from '../index'
import type { ImageCache } from '../linkPreview'
import { ogImage, previewRouteOf, versionOf } from '../linkPreview'
import { META_END, META_START } from '../shellMeta'

/**
 * Link previews for player things (issue 1280). Discord's unfurler
 * (`Discordbot/2.0`) asks for a shared route without a navigation, so the
 * Worker answers it, and must write that thing's preview into the shell —
 * and for a private thing, nothing about it at all.
 */

/** The real shell, so a test fails if index.html loses its markers. */
const SHELL = readFileSync(join(import.meta.dir, '../../../index.html'), 'utf8')

const CONVEX_URL = 'https://convex.example'

/** What the fake Convex answers, by function path then by a key of its args. */
type Answers = Record<string, Record<string, unknown>>

const PATTERN = {
  kind: 'pattern',
  body: { id: 'pat-1', name: 'Tow Rig', chassisRef: 'scrapper', systems: [], modules: [] },
  ownerName: 'alxjrvs',
  gameName: null,
}

const PILOT = {
  kind: 'pilot',
  body: { id: 'p-1', name: 'Rosa Vance', callsign: 'Bonesaw', classRef: 'engineer' },
  ownerName: 'Rosa',
  gameName: 'Reclamation of the Wastes',
}

const INVITE = {
  gameName: 'Reclamation of the Wastes',
  mediatedBy: 'alxjrvs',
  role: 'player',
  requiresApproval: true,
  expiresAt: Date.UTC(2026, 9, 15),
}

const ANSWERS: Answers = {
  'publicSheet:preview': {
    'pattern/pat-1': PATTERN,
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
  new Request(`https://intheunionnow.com${path}`, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)' },
  })

async function unfurl(path: string, e: Env = env()): Promise<string> {
  globalThis.fetch = fakeFetch() as typeof fetch
  const res = await worker.fetch(discordbot(path), e)
  expect(res.status).toBe(200)
  return res.text()
}

function meta(html: string, key: string): string | undefined {
  const match = new RegExp(`<meta[^>]*(?:name|property)="${key}"[^>]*content="([^"]*)"`).exec(html)
  return match?.[1]
}

describe('the shell carries its markers', () => {
  it('wraps the sitewide defaults in itun:meta', () => {
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
    expect(meta(html, 'og:url')).toBe('https://intheunionnow.com/p/pattern/pat-1')
    expect(meta(html, 'og:image')).toBe(
      `https://intheunionnow.com/og/pattern/pat-1.png?v=${versionOf(PATTERN)}`
    )
    expect(meta(html, 'twitter:card')).toBe('summary_large_image')
    expect(html).toContain('<title>Tow Rig</title>')
    // The defaults are replaced, not joined.
    expect(html.match(/property="og:title"/g)).toHaveLength(1)
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
    expect(meta(html, 'og:image')).toStartWith('https://intheunionnow.com/og/pilot/p-1.png?v=')
  })
})

describe('a Discordbot fetch of a private sheet', () => {
  it('unfurls as the plain Private card and leaks nothing', async () => {
    const html = await unfurl('/p/pilot/p-2')
    expect(meta(html, 'og:title')).toBe('Private')
    expect(meta(html, 'og:description')).toBe("Its owner hasn't shared this.")
    expect(meta(html, 'theme-color')).toBe(color.inkDeep)
    // One picture for every private thing: the URL does not carry the id.
    expect(meta(html, 'og:image')).toBe('https://intheunionnow.com/og/private.png?v=1')
    // Nothing but the address the link already is: no kind, no maker, no Game.
    const block = html.slice(html.indexOf(META_START), html.indexOf(META_END))
    expect(block.replace('https://intheunionnow.com/p/pilot/p-2', '')).not.toContain('p-2')
    expect(block).not.toContain('Pilot ·')
    expect(block).not.toContain('Made by')
  })
})

describe('a Discordbot fetch of an invite', () => {
  it('names the Game, its Mediator and the expiry, never the code', async () => {
    const html = await unfurl('/join/K7QR2XA')
    expect(meta(html, 'og:title')).toBe('Reclamation of the Wastes')
    expect(meta(html, 'og:description')).toBe("You're invited · Player seat · Mediated by alxjrvs.")
    // The words never carry the code (the image URL does, as the link itself does).
    expect(meta(html, 'og:title')).not.toContain('K7QR2XA')
    expect(meta(html, 'og:description')).not.toContain('K7QR2XA')
    expect(meta(html, 'theme-color')).toBe(color.crawler)
  })

  it('keeps the sitewide defaults for a dead code', async () => {
    const html = await unfurl('/join/DEADCODE')
    expect(meta(html, 'og:title')).toBe('In The Union Now')
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
    expect(meta(await res.text(), 'og:title')).toBe('In The Union Now')
  })
})

describe('previewRouteOf', () => {
  it('reads the routes a player shares, and nothing else', () => {
    expect(previewRouteOf('/p/pilot/abc')).toEqual({ type: 'sheet', kind: 'pilot', id: 'abc' })
    expect(previewRouteOf('/p/pattern/abc')).toEqual({ type: 'sheet', kind: 'pattern', id: 'abc' })
    expect(previewRouteOf('/join/K7QR2XA')).toEqual({ type: 'invite', code: 'K7QR2XA' })
    expect(previewRouteOf('/p/npc/abc')).toBeNull()
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

const imageRequest = (path: string) => new Request(`https://intheunionnow.com${path}`)

describe('the picture route', () => {
  it('renders the current version once, then serves it from the cache', async () => {
    const cache = memoryCache()
    const fetchImpl = fakeFetch()
    const first = await ogImage(imageRequest('/og/pattern/pat-1.png?v=stale'), env(), {
      cache,
      fetch: fetchImpl,
    })
    expect(first.status).toBe(200)
    expect(first.headers.get('content-type')).toBe('image/png')
    // Keyed by the CURRENT version, whatever `v` the URL carried.
    expect(cache.keys).toEqual([
      `https://intheunionnow.com/og/pattern/pat-1.png?v=${versionOf(PATTERN)}`,
    ])
    const shot = seen.find((r) => r.url.includes('/browser-rendering/screenshot'))
    expect(shot?.body).toMatchObject({
      url: 'https://intheunionnow.com/og/pattern/pat-1',
      viewport: { width: 1200, height: 630 },
    })

    const again = await ogImage(imageRequest('/og/pattern/pat-1.png'), env(), {
      cache,
      fetch: fakeFetch(),
    })
    expect(again.status).toBe(200)
    expect(seen.some((r) => r.url.includes('/browser-rendering/screenshot'))).toBe(false)
  })

  it('an edit is a new version, so a new render', async () => {
    const cache = memoryCache()
    await ogImage(imageRequest('/og/pattern/pat-1.png'), env(), { cache, fetch: fakeFetch() })
    const edited = {
      ...ANSWERS,
      'publicSheet:preview': {
        'pattern/pat-1': { ...PATTERN, body: { ...PATTERN.body, name: 'Tow Rig II' } },
      },
    }
    await ogImage(imageRequest('/og/pattern/pat-1.png'), env(), {
      cache,
      fetch: fakeFetch(edited),
    })
    expect(cache.keys).toHaveLength(2)
  })

  it('a thing made private gets the private card, never its old picture', async () => {
    const cache = memoryCache()
    await ogImage(imageRequest('/og/pattern/pat-1.png'), env(), { cache, fetch: fakeFetch() })
    const madePrivate = { ...ANSWERS, 'publicSheet:preview': { 'pattern/pat-1': null } }
    const res = await ogImage(imageRequest('/og/pattern/pat-1.png'), env(), {
      cache,
      fetch: fakeFetch(madePrivate),
    })
    expect(res.status).toBe(200)
    const shot = seen.find((r) => r.url.includes('/browser-rendering/screenshot'))
    expect(shot?.body).toMatchObject({ url: 'https://intheunionnow.com/og/private' })
  })

  it('404s without a renderer, a dead invite, or a failed render', async () => {
    const cache = memoryCache()
    const noToken = await ogImage(
      imageRequest('/og/pattern/pat-1.png'),
      env({ BROWSER_RENDERING_TOKEN: undefined }),
      { cache, fetch: fakeFetch() }
    )
    expect(noToken.status).toBe(404)
    const dead = await ogImage(imageRequest('/og/invite/DEADCODE.png'), env(), {
      cache,
      fetch: fakeFetch(),
    })
    expect(dead.status).toBe(404)
    const failed = await ogImage(imageRequest('/og/pilot/p-1.png'), env(), {
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
