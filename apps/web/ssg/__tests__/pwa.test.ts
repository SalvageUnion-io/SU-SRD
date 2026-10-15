/**
 * The service worker's runtime rules (`../pwa.ts`).
 *
 * The values are asserted directly. How workbox-build renders them is proven by
 * the build itself — `generateSW` rejects an invalid rule (`networkTimeoutSeconds`
 * on anything but `NetworkFirst`, say), and CI's `build-srd` runs it — and was
 * checked by hand in the emitted `sw.js`.
 */

import { describe, expect, test } from 'bun:test'
import { Glob } from 'bun'
import { UNFETCHED_FONT_SUBSETS } from '../../src/pwa'
import { PAGES_CACHE as WARMED_CACHE } from '../../src/runtime/offlineWarm.client'
import { NAVIGATION_TIMEOUT_SECONDS, PAGES_CACHE, RUNTIME_CACHING, WORKBOX_OPTIONS } from '../pwa'

/** The slice of a fetch event's request the route matchers read. */
const requestOf = (mode: RequestMode, path = '/chassis/') => ({
  request: { mode } as Request,
  url: new URL(`https://salvageunion.io${path}`),
})

const [pages, , searchIndex] = RUNTIME_CACHING

describe('navigations', () => {
  test('go to the network first, not to the cached copy', () => {
    // StaleWhileRevalidate showed every returning visitor the page from their
    // previous visit — one deploy behind — and that copy named chunks the new
    // worker had already dropped.
    expect(pages?.handler).toBe('NetworkFirst')
  })

  test('fall back to the cache only after a short wait', () => {
    expect(pages?.options).toMatchObject({ networkTimeoutSeconds: NAVIGATION_TIMEOUT_SECONDS })
    expect(NAVIGATION_TIMEOUT_SECONDS).toBeGreaterThan(0)
    expect(NAVIGATION_TIMEOUT_SECONDS).toBeLessThanOrEqual(5)
  })

  test('are cached where the installed-app warm writes', () => {
    // Two names for one cache, because client code may not import from ssg/.
    // A mismatch would warm a cache the worker never reads.
    expect(pages?.options.cacheName).toBe(PAGES_CACHE)
    expect(WARMED_CACHE).toBe(PAGES_CACHE)
  })

  test('the rule matches navigations and nothing else', () => {
    const matches = pages?.urlPattern as (options: ReturnType<typeof requestOf>) => boolean
    expect(matches(requestOf('navigate'))).toBe(true)
    expect(matches(requestOf('cors'))).toBe(false)
    expect(matches(requestOf('no-cors'))).toBe(false)
  })

  test("leaves the Cantina's /build navigations to the Cantina's own worker", () => {
    const matches = pages?.urlPattern as (options: ReturnType<typeof requestOf>) => boolean
    expect(matches(requestOf('navigate', '/build'))).toBe(false)
    expect(matches(requestOf('navigate', '/build/'))).toBe(false)
    expect(matches(requestOf('navigate', '/build/sheet/pilot/x'))).toBe(false)
    expect(matches(requestOf('navigate', '/buildings/'))).toBe(true)
  })

  test('the matcher survives being stringified into sw.js', () => {
    // workbox-build writes `urlPattern.toString()` into the worker, so a
    // closure over this module would be a ReferenceError there.
    const rebuilt = new Function(`return (${pages?.urlPattern.toString()})`)() as (
      options: ReturnType<typeof requestOf>
    ) => boolean
    expect(rebuilt(requestOf('navigate'))).toBe(true)
    expect(rebuilt(requestOf('navigate', '/build/'))).toBe(false)
  })
})

describe('the search index', () => {
  test('is cached, so search works offline and a revisit does not refetch it first', () => {
    expect(searchIndex?.handler).toBe('StaleWhileRevalidate')
    const pattern = searchIndex?.urlPattern as RegExp
    expect(pattern.test('https://salvageunion.io/search-index.json')).toBe(true)
    expect(pattern.test('https://salvageunion.io/schema/chassis.json')).toBe(false)
  })
})

describe('the precache', () => {
  // As Vite emits them: the @fontsource file name, then a hash.
  const emitted = (subset: string) =>
    `assets/barlow-semi-condensed-${subset}-500-normal-G0uxJNrM.woff2`
  const ignored = new Glob(UNFETCHED_FONT_SUBSETS)

  test('leaves out the font subsets no rendered text fetches', () => {
    expect(WORKBOX_OPTIONS.globIgnores).toContain(UNFETCHED_FONT_SUBSETS)
    expect(ignored.match(emitted('latin-ext'))).toBe(true)
    expect(ignored.match(emitted('vietnamese'))).toBe(true)
  })

  test('keeps the latin subset every page draws with', () => {
    expect(ignored.match(emitted('latin'))).toBe(false)
    expect(ignored.match('assets/barlow-latin-400-normal-qiz4-Cze.woff2')).toBe(false)
  })

  test("keeps workbox-build's default ignore, which setting globIgnores replaces", () => {
    expect(WORKBOX_OPTIONS.globIgnores).toContain('**/node_modules/**/*')
  })

  test('never holds the Cantina, which its own worker at /build/ precaches', () => {
    const cantina = new Glob('build/**')
    expect(WORKBOX_OPTIONS.globIgnores).toContain('build/**')
    expect(cantina.match('build/assets/index-DEADBEEF.js')).toBe(true)
    expect(cantina.match('assets/base-DEADBEEF.css')).toBe(false)
  })
})
