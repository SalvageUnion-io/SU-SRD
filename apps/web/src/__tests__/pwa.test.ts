/**
 * The one service worker's workbox options (`../pwa.ts`), asserted directly.
 * How workbox-build renders them is proven by the build itself (`generateSW`
 * rejects an invalid rule, and CI's `build-web` runs it) and was checked in
 * the emitted `sw.js`.
 */

import { describe, expect, test } from 'bun:test'
import { Glob } from 'bun'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { APP_BASE, appPath } from '../lib/appBase'
import {
  NAVIGATION_TIMEOUT_SECONDS,
  PAGES_CACHE,
  RUNTIME_CACHING,
  SITE_MANIFEST,
  UNFETCHED_FONT_SUBSETS,
  WORKBOX_OPTIONS,
} from '../pwa'

type Matcher = (options: { request: Request; url: URL }) => boolean

const requestOf = (mode: RequestMode, path = '/chassis/') => ({
  request: { mode } as Request,
  url: new URL(`https://salvageunion.io${path}`),
})

/** The first rule that matches, as workbox routes it. */
const ruleFor = (mode: RequestMode, path: string) =>
  RUNTIME_CACHING.find(
    (rule) => typeof rule.urlPattern === 'function' && rule.urlPattern(requestOf(mode, path))
  )

describe('builder navigations', () => {
  test.each([APP_BASE, appPath('/'), appPath('/sheet/pilot/x')])(
    '%s goes to the network, then the precached shell',
    (path) => {
      const rule = ruleFor('navigate', path)
      expect(rule?.handler).toBe('NetworkOnly')
      expect(rule?.options).toEqual({ precacheFallback: { fallbackURL: 'build/index.html' } })
    }
  )
})

describe('page navigations', () => {
  test.each(['/chassis/', '/buildings/', '/'])('%s goes to the network first', (path) => {
    const rule = ruleFor('navigate', path)
    expect(rule?.handler).toBe('NetworkFirst')
    expect(rule?.options).toMatchObject({
      cacheName: PAGES_CACHE,
      networkTimeoutSeconds: NAVIGATION_TIMEOUT_SECONDS,
    })
  })

  test('the home page, where the installed app opens, falls back to its precached copy', () => {
    expect(ruleFor('navigate', '/')?.options).toMatchObject({
      precacheFallback: { fallbackURL: 'index.html' },
    })
    expect(ruleFor('navigate', '/chassis/')?.options).not.toHaveProperty('precacheFallback')
  })

  test('fall back to the cache only after a short wait', () => {
    expect(NAVIGATION_TIMEOUT_SECONDS).toBeGreaterThan(0)
    expect(NAVIGATION_TIMEOUT_SECONDS).toBeLessThanOrEqual(5)
  })
})

describe('the navigation rules', () => {
  const navigation = RUNTIME_CACHING.filter((rule) => typeof rule.urlPattern === 'function')

  test.each(['cors', 'no-cors', 'same-origin'] as const)(
    'leave a %s request (a chunk, an API call) to the precache and the network',
    (mode) => {
      expect(ruleFor(mode, '/assets/index-DEADBEEF.js')).toBeUndefined()
    }
  )

  test('survive being stringified into sw.js', () => {
    // workbox-build writes `urlPattern.toString()` into the worker, so a
    // closure over this module would be a ReferenceError there.
    for (const rule of navigation) {
      const original = rule.urlPattern as Matcher
      const rebuilt = new Function(`return (${original.toString()})`)() as Matcher
      for (const path of ['/', '/build/', '/chassis/']) {
        expect(rebuilt(requestOf('navigate', path))).toBe(original(requestOf('navigate', path)))
      }
    }
  })

  test('no precache route answers a navigation first', () => {
    // precacheAndRoute registers before every runtime rule and, by default,
    // maps `/` and `/build/` onto their index.html: cache-first.
    expect(WORKBOX_OPTIONS.directoryIndex).toBeNull()
    expect(WORKBOX_OPTIONS.navigateFallback).toBeNull()
  })
})

describe('the search index', () => {
  test('is cached, so search works offline', () => {
    const rule = RUNTIME_CACHING.find(
      (r) => r.urlPattern instanceof RegExp && r.urlPattern.test('/search-index.json')
    )
    expect(rule?.handler).toBe('StaleWhileRevalidate')
  })
})

describe('the precache', () => {
  const matches = (file: string) =>
    WORKBOX_OPTIONS.globPatterns.some((glob) => new Glob(glob).match(file)) &&
    !WORKBOX_OPTIONS.globIgnores.some((glob) => new Glob(glob).match(file))

  test('holds both halves, so either opens offline from the other', () => {
    expect(matches('index.html')).toBe(true)
    expect(matches('build/index.html')).toBe(true)
    expect(matches('assets/islands-DEADBEEF.js')).toBe(true)
    expect(matches('assets/main-DEADBEEF.js')).toBe(true)
    expect(matches('assets/base-DEADBEEF.css')).toBe(true)
    expect(matches('web-app-manifest-192x192.png')).toBe(true)
  })

  test('holds no other page, and no retired worker', () => {
    expect(matches('chassis/mule/index.html')).toBe(false)
    expect(matches('build/starter.html')).toBe(false)
    expect(matches('build/starter/crawler/x.html')).toBe(false)
    expect(matches('build/sw.js')).toBe(false)
    expect(matches('og-image.png')).toBe(false)
  })

  test('leaves out the font subsets no rendered text fetches', () => {
    const emitted = (subset: string) =>
      `assets/barlow-semi-condensed-${subset}-500-normal-G0uxJNrM.woff2`
    expect(new Glob(UNFETCHED_FONT_SUBSETS).match(emitted('latin-ext'))).toBe(true)
    expect(matches(emitted('latin-ext'))).toBe(false)
    expect(matches(emitted('vietnamese'))).toBe(false)
    expect(matches(emitted('latin'))).toBe(true)
  })

  test("keeps workbox-build's default ignore, which setting globIgnores replaces", () => {
    expect(WORKBOX_OPTIONS.globIgnores).toContain('**/node_modules/**/*')
  })
})

describe('the one install', () => {
  const manifest = JSON.parse(
    readFileSync(join(import.meta.dir, '../../public/site.webmanifest'), 'utf8')
  )

  test('is the whole site, opening at its home page', () => {
    expect(manifest).toMatchObject({ id: '/', start_url: '/', scope: '/' })
    expect(manifest.name).toBe('Salvage Union')
  })

  test('is linked from the same address every page names', () => {
    expect(SITE_MANIFEST).toBe('/site.webmanifest')
  })
})
