/**
 * The service worker's workbox options (`../workbox.ts`) — the half of "every
 * visit gets the latest version" that lives in the worker.
 *
 * These are the values `vite.config.ts` hands `VitePWA`, asserted directly.
 * What they cannot prove is how workbox-build renders them into `sw.js`; that
 * was checked against a real build (the emitted worker registers
 * `precacheAndRoute(…, {directoryIndex: null})` and a `NetworkOnly` navigation
 * route with a `PrecacheFallbackPlugin` for `index.html`, and no
 * `NavigationRoute`).
 */

import { describe, expect, it } from 'bun:test'
import { Glob } from 'bun'
import { UNFETCHED_FONT_SUBSETS } from '../../../../pwa'
import { WORKBOX_OPTIONS } from '../workbox'

/** The slice of a fetch event's request the route matcher reads. */
const requestOf = (mode: RequestMode) => ({ request: { mode } as Request })

const navigationRules = WORKBOX_OPTIONS.runtimeCaching.filter((rule) =>
  rule.urlPattern(requestOf('navigate'))
)

describe('navigations go to the network before the precache', () => {
  it('registers no precache-bound NavigationRoute', () => {
    // `navigateFallback` is what made every navigation a precache hit, so a
    // returning visitor booted whatever build they had last seen.
    expect(WORKBOX_OPTIONS.navigateFallback).toBeNull()
  })

  it('does not let the precache route answer `/` either', () => {
    // precacheAndRoute is registered before any runtime rule and, by default,
    // maps a URL ending in `/` onto `index.html` — which would keep the PWA's
    // start_url cache-first even with the rule below in place.
    expect(WORKBOX_OPTIONS.directoryIndex).toBeNull()
  })

  it('has exactly one rule for navigations: the network, then the precached shell', () => {
    expect(navigationRules).toHaveLength(1)
    const [rule] = navigationRules
    expect(rule?.handler).toBe('NetworkOnly')
    expect(rule?.options.precacheFallback.fallbackURL).toBe('index.html')
  })

  it('keeps the fallback shell in the precache', () => {
    // A precache fallback naming a file the glob does not pick up would leave
    // offline navigations with nothing to answer them.
    expect(WORKBOX_OPTIONS.globPatterns.some((glob) => glob.includes('html'))).toBe(true)
  })

  it.each(['cors', 'no-cors', 'same-origin'] as const)(
    'leaves a %s request (a chunk, an API call) to the precache and the network',
    (mode) => {
      // A hashed chunk the active worker's precache does not list must fall
      // through to the network untouched, or a fresh shell could not load it.
      expect(navigationRules[0]?.urlPattern(requestOf(mode))).toBe(false)
    }
  )
})

describe('the route matcher survives being stringified into sw.js', () => {
  it('references nothing but its own argument', () => {
    // workbox-build writes `urlPattern.toString()` into the worker, so a
    // closure over this module's scope would be a ReferenceError there. Rebuild
    // it from its source, outside this module, the same way.
    const source = navigationRules[0]?.urlPattern.toString() ?? ''
    const rebuilt = new Function(`return (${source})`)() as (options: {
      request: Request
    }) => boolean

    expect(rebuilt(requestOf('navigate'))).toBe(true)
    expect(rebuilt(requestOf('cors'))).toBe(false)
  })
})

describe('the precache', () => {
  // As Vite emits them: the @fontsource file name, then a hash.
  const emitted = (subset: string) =>
    `assets/barlow-semi-condensed-${subset}-500-normal-G0uxJNrM.woff2`
  const ignored = new Glob(UNFETCHED_FONT_SUBSETS)

  it("leaves out the font subsets the app's own text never fetches", () => {
    expect(WORKBOX_OPTIONS.globIgnores).toContain(UNFETCHED_FONT_SUBSETS)
    expect(ignored.match(emitted('latin-ext'))).toBe(true)
    expect(ignored.match(emitted('vietnamese'))).toBe(true)
  })

  it('keeps the latin subset every page draws with', () => {
    expect(ignored.match(emitted('latin'))).toBe(false)
    expect(ignored.match('assets/barlow-latin-400-normal-qiz4-Cze.woff2')).toBe(false)
  })

  it("keeps workbox-build's default ignore, which setting globIgnores replaces", () => {
    expect(WORKBOX_OPTIONS.globIgnores).toContain('**/node_modules/**/*')
  })
})
