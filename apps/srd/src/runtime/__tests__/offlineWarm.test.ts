/**
 * The install-gated offline warm (ADR-034 decision 3, plan phase P7).
 *
 * Two rules are being enforced and they pull against each other, so both need
 * asserting rather than one: an **installed** app must end up holding every
 * page, and a **browser tab** must download nothing extra at all. The second is
 * the one that would rot quietly — a warm that fires for everybody still looks
 * like it works, it just costs every casual reader 3.73 MB.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { warmOfflineCacheIfInstalled } from '../offlineWarm.client'

type FakeCache = {
  entries: Map<string, unknown>
  match: (k: string) => Promise<unknown>
  put: (k: string, v: unknown) => Promise<void>
}

let cache: FakeCache
let fetched: string[]
let standalone: boolean
let pageStatus: number

/**
 * Only three globals are stubbed, and each is restored afterwards.
 *
 * happy-dom already provides `window`, `location`, `navigator` and
 * `sessionStorage`, and an earlier draft replaced them anyway — which broke the
 * shared `test/testing-library.ts` preload, whose `afterEach` calls
 * `sessionStorage.clear()` on a global this file had deleted. Stub the least
 * that makes the test possible, and put back exactly what was replaced.
 */
const originals: Record<string, unknown> = {}

function stub(name: string, value: unknown): void {
  originals[name] = (globalThis as Record<string, unknown>)[name]
  ;(globalThis as Record<string, unknown>)[name] = value
}

function makeCache(): FakeCache {
  const entries = new Map<string, unknown>()
  return {
    entries,
    match: async (k) => entries.get(k),
    put: async (k, v) => {
      entries.set(k, v)
    },
  }
}

/** Built from the live origin so the same-origin filter is exercised for real. */
function sitemapFor(origin: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset>
  <url><loc>${origin}/</loc></url>
  <url><loc>${origin}/chassis/iron-mongrel</loc></url>
  <url><loc>https://evil.example.com/steal-me</loc></url>
</urlset>`
}

beforeEach(() => {
  cache = makeCache()
  fetched = []
  standalone = false
  pageStatus = 200
  sessionStorage.clear()

  // happy-dom boots on `about:blank`, whose origin is the string "null" — not a
  // URL, so every sitemap entry failed to parse and the warm silently cached
  // nothing while still looking like it ran. Give the document a real URL so the
  // same-origin filter is exercised against a real origin.
  const dom = (window as unknown as { happyDOM?: { setURL: (u: string) => void } }).happyDOM
  dom?.setURL('https://salvageunion.io/')

  // `display-mode` is what separates an installed app from a tab, and there is
  // no way to ask happy-dom for it — so it is stubbed at the one call site that
  // reads it.
  stub('matchMedia', (q: string) => ({ matches: standalone && q.includes('standalone') }))
  stub('caches', { open: async () => cache })
  stub('fetch', async (url: string) => {
    fetched.push(url)
    if (url === '/sitemap-0.xml') {
      return { ok: true, status: 200, text: async () => sitemapFor(window.location.origin) }
    }
    return { ok: pageStatus === 200, status: pageStatus, clone: () => ({ body: url }) }
  })
})

afterEach(() => {
  // Process-global state is the caller's to put back — see
  // .claude/rules/testing-patterns.md.
  for (const [name, value] of Object.entries(originals)) {
    ;(globalThis as Record<string, unknown>)[name] = value
  }
})

describe('a browser tab downloads nothing extra', () => {
  test('not installed means not one request', async () => {
    await warmOfflineCacheIfInstalled()

    // Not "no pages cached" — NO REQUESTS AT ALL, including the sitemap. An
    // online reader who came for one page must pay nothing for a feature they
    // did not ask for.
    expect(fetched).toEqual([])
    expect(cache.entries.size).toBe(0)
  })
})

describe('an installed app ends up holding the site', () => {
  beforeEach(() => {
    standalone = true
  })

  test('every same-origin page is cached', async () => {
    await warmOfflineCacheIfInstalled()

    expect(cache.entries.has('/')).toBe(true)
    expect(cache.entries.has('/chassis/iron-mongrel')).toBe(true)
  })

  test('a foreign origin in the sitemap is ignored', async () => {
    await warmOfflineCacheIfInstalled()

    // A sitemap is site-controlled, but writing whatever it names into the cache
    // the app serves from is not something to do on trust.
    expect([...cache.entries.keys()].some((k) => k.includes('evil.example.com'))).toBe(false)
  })

  test('a page that is already cached is not refetched', async () => {
    await cache.put('/chassis/iron-mongrel', { body: 'already here' })

    await warmOfflineCacheIfInstalled()

    expect(fetched).not.toContain('/chassis/iron-mongrel')
    // Idempotence without needing a build version to key a marker on, which is
    // the reason it is written this way.
    expect(cache.entries.get('/chassis/iron-mongrel')).toEqual({ body: 'already here' })
  })

  test('a non-200 response is not cached', async () => {
    pageStatus = 404

    await warmOfflineCacheIfInstalled()

    // Caching a 404 would make the app confidently serve the wrong thing
    // offline, which is worse than serving nothing.
    expect(cache.entries.size).toBe(0)
  })

  test('it runs once per tab', async () => {
    await warmOfflineCacheIfInstalled()
    const first = fetched.length
    await warmOfflineCacheIfInstalled()

    expect(fetched.length).toBe(first)
  })
})
