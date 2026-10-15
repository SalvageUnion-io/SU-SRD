import { describe, expect, test } from 'bun:test'
import { renderShell } from '../../shell/shell'
import { APP_BASE, appPath, appRoot, appUrl, originOf, pageOrigin, routeInApp } from '../site'

const siteUrl = appUrl('/', originOf())

/** The Cantina at salvageunion.io/build (ADR-048, `site.ts`). */
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

  test("the shell's sitewide og:url and og:image point there", () => {
    const html = renderShell()
    expect(html).toContain(`<meta property="og:url" content="${siteUrl}" />`)
    expect(html).toContain(`content="${siteUrl}og-image.png"`)
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
    expect(appRoot('https://salvageunion.io/')).toBe('https://salvageunion.io/build')
  })
})
