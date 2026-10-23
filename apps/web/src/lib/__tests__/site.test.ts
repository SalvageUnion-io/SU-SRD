import { describe, expect, test } from 'bun:test'
import { renderShell } from '../../shell/shell'
import { APP_BASE, appPath, routeInApp } from '../appBase'
import { appUrl, originOf, pageOrigin } from '../site'

const siteUrl = appUrl('/', originOf())

/** The app at salvageunion.io/build (ADR-048, `appBase.ts`). */
describe('the app base', () => {
  test('is salvageunion.io/build', () => {
    expect(siteUrl).toBe('https://salvageunion.io/build/')
    expect(APP_BASE).toBe('/build')
    expect(appPath('/starter')).toBe('/build/starter')
  })

  test('a site path names a route inside it, or none', () => {
    expect(routeInApp('/build')).toBe('/')
    expect(routeInApp('/build/')).toBe('/')
    expect(routeInApp('/build/p/mech/x')).toBe('/p/mech/x')
    expect(routeInApp('/buildings/')).toBeNull()
    expect(routeInApp('/chassis/')).toBeNull()
  })

  test("the shell's sitewide og:url points there, and its og:image is the site's own", () => {
    const html = renderShell()
    expect(html).toContain(`<meta property="og:url" content="${siteUrl}" />`)
    expect(html).toContain(`content="https://salvageunion.io/og-image.png"`)
    expect(html).not.toContain('intheunionnow.com/')
  })
})

describe('the origin', () => {
  test("is production's unless one is given, never with a trailing slash", () => {
    expect(originOf()).toBe('https://salvageunion.io')
    expect(originOf('')).toBe('https://salvageunion.io')
    expect(originOf('https://pr-7-su-srd.example.workers.dev/')).toBe(
      'https://pr-7-su-srd.example.workers.dev'
    )
  })

  test("a page's is its own: production, a Preview or the dev server alike", () => {
    expect(pageOrigin('http://localhost:4321')).toBe('http://localhost:4321')
    expect(pageOrigin('https://pr-7-su-srd.example.workers.dev')).toBe(
      'https://pr-7-su-srd.example.workers.dev'
    )
  })

  test("is production's outside a page", () => {
    expect(pageOrigin('')).toBe('https://salvageunion.io')
    expect(pageOrigin('null')).toBe('https://salvageunion.io')
  })
})

describe('appUrl', () => {
  test('joins origin, base and route', () => {
    expect(appUrl('/p/mech/abc', 'https://salvageunion.io')).toBe(
      'https://salvageunion.io/build/p/mech/abc'
    )
  })

  test('a Play route is at its own path, outside the base', () => {
    expect(appUrl('/play/games/g1', 'https://salvageunion.io/')).toBe(
      'https://salvageunion.io/play/games/g1'
    )
  })
})
