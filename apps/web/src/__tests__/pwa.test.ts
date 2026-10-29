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
import { APP_BASE, appPath, PLAY_ROOT, routeInApp } from '../lib/appBase'
import {
  APP_PATH,
  NAVIGATION_TIMEOUT_SECONDS,
  PAGES_CACHE,
  RUNTIME_CACHING,
  SITE_MANIFEST,
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
  test.each([APP_BASE, appPath('/'), appPath('/pilots/x')])(
    '%s goes to the network, then the precached shell',
    (path) => {
      const rule = ruleFor('navigate', path)
      expect(rule?.handler).toBe('NetworkOnly')
      expect(rule?.options).toEqual({ precacheFallback: { fallbackURL: 'build/index.html' } })
    }
  )
})

describe('the app paths', () => {
  test.each([
    APP_BASE,
    appPath('/'),
    appPath('/pilots/x'),
    PLAY_ROOT,
    appPath('/play/games/x'),
    '/',
    '/chassis/',
    '/builder/',
    '/playbook/',
  ])('%s is the app exactly where routeInApp says so', (path) => {
    expect(APP_PATH.test(path)).toBe(routeInApp(path) !== null)
  })

  test('are the ones the app rule spells out', () => {
    const appRule = ruleFor('navigate', APP_BASE)
    expect(String(appRule?.urlPattern)).toContain(`${APP_PATH}.test(url.pathname)`)
  })

  test('are the ones sw-lifecycle.js spells out', () => {
    const lifecycle = readFileSync(join(import.meta.dir, '../../public/sw-lifecycle.js'), 'utf8')
    expect(lifecycle).toContain(`const BUILDER = ${APP_PATH}`)
  })
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
      for (const path of ['/', '/build/', '/play/games/x', '/chassis/']) {
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

describe('the data rules', () => {
  test('cache only what a page fetches: the search index', () => {
    const data = RUNTIME_CACHING.filter((r) => r.urlPattern instanceof RegExp)
    expect(data.map((r) => String(r.urlPattern))).toEqual([String(/\/search-index\.json$/)])
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

  test('holds the faces Astro emits', () => {
    expect(matches('assets/fonts/1a2b3c4d5e6f.woff2')).toBe(true)
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
    expect(manifest.name).toBe('SalvageUnion.io')
  })

  test('is linked from the same address every page names', () => {
    expect(SITE_MANIFEST).toBe('/site.webmanifest')
  })
})
