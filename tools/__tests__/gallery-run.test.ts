/**
 * `tools/gallery.ts`'s `run`: which pages it shoots, where each link-preview
 * image comes from, how a failure is recorded, and the signed-in seed — against
 * a stand-in Playwright that runs the page callbacks on a fake `document`.
 */
import { afterAll, describe, expect, spyOn, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Browser } from '@playwright/test'
import { GALLERY_SECTIONS, pageSlug } from 'gates/lib/galleryPages'
import { main, signedInTargets, signedOutTargets } from '../gallery'
import { fixtureTrees } from './fixtureTree'

const tree = fixtureTrees('gallery-run')
const log = spyOn(console, 'log').mockImplementation(() => {})
afterAll(() => log.mockRestore())

const SITE = 'http://site.test'
const ALL = GALLERY_SECTIONS.flatMap((s) => s.pages)

type Fn = (...args: unknown[]) => unknown

/** What the fake records and how it answers. */
type World = {
  calls: string[]
  /** URLs whose `goto` answers this status (default 200). */
  status: Map<string, number>
  /** URLs whose `goto` throws. */
  broken: Set<string>
  /** The og:image every page names, or none. */
  ogImage?: string
  /** The hrefs the Cantina's root lists after the seed. */
  links: string[]
  url: string
}

/**
 * Run a page callback the way the browser would: with `document` and the
 * test hooks on `globalThis`, restored afterwards.
 */
async function inPage(world: World, fn: Fn, arg?: unknown): Promise<unknown> {
  const g = globalThis as Record<string, unknown>
  const saved = { document: g.document, og: g.__ogSetEntity, signIn: g.__cantinaTestSignIn }
  const meta: Record<string, string | undefined> = {
    'og:image': world.ogImage,
    'og:title': 'Title',
    'og:description': 'Description',
  }
  g.document = {
    querySelector: (selector: string) => {
      const key = /property="([^"]+)"/.exec(selector)?.[1] ?? ''
      return meta[key] === undefined ? null : { getAttribute: () => meta[key] ?? null }
    },
    querySelectorAll: () => world.links.map((href) => ({ getAttribute: () => href })),
    documentElement: { hasAttribute: () => true },
    fonts: { ready: Promise.resolve() },
  }
  g.__ogSetEntity = (...entity: unknown[]) => world.calls.push(`og-entity ${entity.join(' ')}`)
  g.__cantinaTestSignIn = async (email: string) => {
    world.calls.push(`sign-in ${email.replace(/\d+/, 'N')}`)
  }
  try {
    return await fn(arg)
  } finally {
    g.document = saved.document
    g.__ogSetEntity = saved.og
    g.__cantinaTestSignIn = saved.signIn
  }
}

/** A locator that resolves everything; `evaluate` runs on a select offering Shelves. */
function locator(world: World, name: string): Record<string, Fn> {
  const self: Record<string, Fn> = {
    or: () => self,
    first: () => self,
    getByRole: (role, opts) =>
      locator(world, `${name} > ${(opts as { name?: unknown } | undefined)?.name ?? role}`),
    count: async () => 1,
    click: async () => world.calls.push(`click ${name}`),
    waitFor: async () => {},
    fill: async (text) => world.calls.push(`fill ${name} ${text}`),
    selectOption: async (value) => world.calls.push(`select ${value}`),
    evaluate: async (fn) =>
      (fn as Fn)({ options: [{ textContent: 'Hangar', value: 'shelves-id' }] }),
    screenshot: async (opts) => world.calls.push(`card ${(opts as { path: string }).path}`),
  }
  return self
}

function fakePage(world: World): Record<string, Fn> {
  return {
    setViewportSize: async (size) =>
      world.calls.push(`viewport ${(size as { width: number }).width}`),
    goto: async (url) => {
      world.url = url as string
      world.calls.push(`goto ${url}`)
      if (world.broken.has(url as string)) throw new Error(`net::ERR at ${url}\nstack`)
      const status = world.status.get(url as string) ?? 200
      return { status: () => status }
    },
    waitForTimeout: async () => {},
    waitForFunction: async () => {},
    waitForURL: async () => {
      world.url = `${SITE}/build/games/g1`
    },
    url: () => world.url,
    evaluate: (fn, arg) => inPage(world, fn as Fn, arg),
    screenshot: async (opts) => world.calls.push(`shot ${(opts as { path: string }).path}`),
    locator: (selector) => locator(world, selector as string),
    getByRole: (role, opts) =>
      locator(world, `${role}${opts ? `:${(opts as { name: unknown }).name}` : ''}`),
    getByText: (text) => locator(world, String(text)),
    getByLabel: (label) => locator(world, label as string),
    close: async () => {},
  }
}

function fakeBrowser(world: World): () => Promise<Browser> {
  const context = {
    newPage: async () => fakePage(world),
    close: async () => world.calls.push('context closed'),
  }
  const browser = {
    newContext: async () => context,
    close: async () => world.calls.push('browser closed'),
  }
  return async () => browser as unknown as Browser
}

const world = (over: Partial<World> = {}): World => ({
  calls: [],
  status: new Map(),
  broken: new Set(),
  links: [],
  url: '',
  ...over,
})

const gallery = async (argv: string[], w: World) => {
  const out = tree({})
  const dots: string[] = []
  const code = await main([...argv, '--out', out, '--sha', 'abc'], {
    launch: fakeBrowser(w),
    now: () => new Date('2026-10-14T12:34:56Z'),
    progress: (d) => dots.push(d),
  })
  const manifest = JSON.parse(readFileSync(join(out, 'gallery.json'), 'utf8'))
  return { code, out, dots, manifest }
}

describe('gallery run', () => {
  test('a bad argument exits 2 without launching a browser', async () => {
    const errors: string[] = []
    const code = await main(['--base'], {
      launch: async () => {
        throw new Error('launched')
      },
      error: (l) => errors.push(l),
    })
    expect(code).toBe(2)
    expect(errors[0]).toStartWith('--base needs a value')
  })

  test('shoots every signed-out page at both widths and renders each entity card', async () => {
    const w = world()
    const targets = signedOutTargets(SITE)
    const r = await gallery(['--base', SITE], w)
    expect(r.code).toBe(0)
    expect(r.dots).toHaveLength(targets.length)
    expect(r.manifest).toEqual({
      pr: null,
      sha: 'abc',
      capturedAt: '2026-10-14 12:34 UTC',
      pages: targets.length,
      failures: [],
    })
    const first = targets[0]
    if (!first) throw new Error('no targets')
    expect(w.calls).toContain(`shot ${join(r.out, 'shots', `${first.slug}-desk.jpg`)}`)
    expect(w.calls).toContain(`shot ${join(r.out, 'shots', `${first.slug}-phone.jpg`)}`)
    // Entity pages get their card rendered on /og-card/; nothing else is fetched.
    const cards = w.calls.filter((c) => c.startsWith('card '))
    expect(cards.length).toBeGreaterThan(0)
    expect(w.calls).toContain(`goto ${SITE}/og-card/`)
    expect(w.calls.filter((c) => c.startsWith('og-entity'))).toHaveLength(cards.length)
    expect(w.calls.at(-1)).toBe('browser closed')
    expect(w.calls.some((c) => c.includes('sign-in'))).toBe(false)
  })

  test('a page that errors or answers 4xx is a failure line; the rest are still shot', async () => {
    const [a, b] = signedOutTargets(SITE)
    if (!a || !b) throw new Error('need two pages')
    const w = world({ status: new Map([[a.url, 404]]), broken: new Set([b.url]) })
    const r = await gallery(['--base', SITE], w)
    expect(r.code).toBe(1)
    expect(r.manifest.failures).toEqual([
      `${a.page.path}: ${a.url} answered 404`,
      `${b.page.path}: net::ERR at ${b.url}`,
    ])
    expect(r.manifest.pages).toBe(signedOutTargets(SITE).length - 2)
  })

  test('signed in: seeds an account, shoots its pages in Edit, and reports what it could not make', async () => {
    const w = world({
      links: ['/build/sheet/pilot/p1', '/build/sheet/mech/m1', '/elsewhere'],
    })
    const r = await gallery(['--base', SITE, '--signed-in'], w)
    const seeded = {
      pilot: '/build/sheet/pilot/p1',
      mech: '/build/sheet/mech/m1',
      game: '/build/games/g1',
    }
    const planned = signedInTargets(SITE, seeded)
    expect(planned.failures.length).toBe(1)
    expect(r.manifest.failures).toEqual(planned.failures)
    expect(r.code).toBe(1)
    expect(w.calls).toContain('sign-in gallery-N@example.com')
    expect(w.calls.filter((c) => c === 'select shelves-id')).toHaveLength(3)
    expect(w.calls).toContain('fill New Game name The Long Haul')
    expect(w.calls).toContain('click dialog > The Long Haul')
    // An edit page switches to Edit before each width is shot.
    const pilot = ALL.find((p) => p.path === ':pilot')
    if (!pilot) throw new Error('no :pilot page')
    expect(w.calls).toContain(`shot ${join(r.out, 'shots', `${pageSlug(pilot)}-desk.jpg`)}`)
    expect(w.calls.filter((c) => c.startsWith('click radio:Edit')).length).toBeGreaterThan(0)
  })

  test('a seed that fails is one failure, and every placeholder page is reported unmade', async () => {
    const w = world({ broken: new Set([`${SITE}/build/`]) })
    const r = await gallery(['--base', SITE, '--signed-in'], w)
    expect(r.code).toBe(1)
    expect(r.manifest.failures).toContain(`seed: net::ERR at ${SITE}/build/`)
    expect(r.manifest.failures).toContain(':pilot: the seed made no such entity')
    // The signed-out Cantina root fails too: it is the same broken URL.
    expect(r.manifest.failures).toContain(`/build/: net::ERR at ${SITE}/build/`)
  })

  test('a non-entity page with an og:image fetches it from the shot origin', async () => {
    const fetched: string[] = []
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (url: string) => {
      fetched.push(url)
      return new Response('png', { headers: { 'content-type': 'image/png' } })
    }) as unknown as typeof fetch
    try {
      const r = await gallery(['--base', SITE], world({ ogImage: 'https://cdn.example/og/x.png' }))
      expect(r.code).toBe(0)
      expect(fetched.length).toBeGreaterThan(0)
      expect(fetched.every((u) => u === `${SITE}/og/x.png`)).toBe(true)
    } finally {
      globalThis.fetch = realFetch
    }
  })
})
