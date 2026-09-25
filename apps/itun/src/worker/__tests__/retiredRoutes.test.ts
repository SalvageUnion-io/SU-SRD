/**
 * The retired-URL table (`../retiredRoutes.ts`) — the one list both the
 * Worker's 301 and the service worker's navigation denylist are built from.
 *
 * Each retired URL used to need a client-side route that only `throw redirect()`
 * (audit AP-18), because an installed PWA answers navigations from its precache
 * and never reaches the Worker. The denylist is what retired those routes, so
 * the last test here pins that `vite.config.ts` still wires it in.
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { RETIRED_NAVIGATIONS, retiredRedirect } from '../retiredRoutes'

describe('retiredRedirect', () => {
  test.each([
    ['/sheet/pilot/pilot-1/share', '/sheet/pilot/pilot-1'],
    [
      '/sheet/mech/0246f9a3-84db-4968-b295-4cc8b6b2c2f5/share/',
      '/sheet/mech/0246f9a3-84db-4968-b295-4cc8b6b2c2f5',
    ],
    ['/pilots/pilot-1', '/sheet/pilot/pilot-1'],
    ['/mechs/mech-1/', '/sheet/mech/mech-1'],
    ['/crawlers/crawler-9', '/sheet/crawler/crawler-9'],
  ])('%s → %s', (from, to) => {
    expect(retiredRedirect(from)).toBe(to)
  })

  test.each([
    // Live routes under the same prefixes: the wizards and the pattern library.
    '/pilots/new',
    '/mechs/new/',
    '/crawlers/new',
    '/mechs/patterns',
    '/mechs/patterns/',
    // The sheet itself, and anything deeper than a detail page.
    '/sheet/pilot/abc123',
    '/pilots/abc/edit',
    '/pilots',
    '/',
  ])('leaves live path %s alone', (path) => {
    expect(retiredRedirect(path)).toBeNull()
  })
})

describe('the service worker denylist', () => {
  // Workbox matches pathname + search, so a query string must not let a
  // retired URL slip through to the precached shell.
  test.each(['/pilots/abc', '/pilots/abc?from=bookmark', '/sheet/mech/xyz/share?utm=1'])(
    'denies %s',
    (url) => {
      expect(RETIRED_NAVIGATIONS.some((re) => re.test(url))).toBe(true)
    }
  )

  test.each(['/pilots/new', '/pilots/new?mode=guided', '/mechs/patterns', '/sheet/pilot/abc'])(
    'still serves %s from the shell',
    (url) => {
      expect(RETIRED_NAVIGATIONS.some((re) => re.test(url))).toBe(false)
    }
  )

  test('vite.config.ts hands the table to workbox', () => {
    const config = readFileSync(new URL('../../../vite.config.ts', import.meta.url), 'utf8')
    expect(config).toContain("from './src/worker/retiredRoutes'")
    expect(config).toContain('navigateFallbackDenylist: [...RETIRED_NAVIGATIONS]')
  })
})
