/**
 * The retired-URL table (`../retiredRoutes.ts`) — the list the Worker's 301
 * is built from.
 *
 * Each retired URL used to need a client-side route that only `throw redirect()`
 * (audit AP-18), because an installed PWA answered navigations from its
 * precache and never reached the Worker. Navigations are network-first now, so
 * the 301 reaches it; `src/lib/sw/__tests__/workbox.test.ts` holds that half.
 */

import { describe, expect, test } from 'bun:test'
import { retiredRedirect } from '../retiredRoutes'

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
