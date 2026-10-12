import { describe, expect, test } from 'bun:test'
import { appRoot, appUrl, BASE_PATH } from '../appUrl'
import {
  basePathOf,
  headersForBase,
  itunSite,
  ONE_DOMAIN,
  STANDALONE,
  shellForSite,
  siteUrl,
} from '../site'

/** Refit S2 spike: where ITUN is served, picked at build time (`site.ts`). */
describe('itunSite', () => {
  test('is intheunionnow.com at the root unless the build asks otherwise', () => {
    expect(itunSite(undefined)).toBe(STANDALONE)
    expect(itunSite('')).toBe(STANDALONE)
    expect(itunSite('standalone')).toBe(STANDALONE)
    expect(siteUrl(STANDALONE)).toBe('https://intheunionnow.com/')
  })

  test('is salvageunion.io/build for one-domain', () => {
    expect(itunSite('one-domain')).toBe(ONE_DOMAIN)
    expect(siteUrl(ONE_DOMAIN)).toBe('https://salvageunion.io/build/')
    expect(basePathOf(ONE_DOMAIN.base)).toBe('/build')
    expect(basePathOf(STANDALONE.base)).toBe('')
  })

  test('refuses anything else rather than guess', () => {
    expect(() => itunSite('build')).toThrow('ITUN_SITE')
  })
})

describe('headersForBase', () => {
  const headers = '/*\n  X-Frame-Options: DENY\n\n/assets/*\n  Cache-Control: immutable\n'

  test('leaves the root build’s file alone', () => {
    expect(headersForBase(headers, '/')).toBe(headers)
  })

  test('scopes the immutable rule to the base, and keeps the sitewide block', () => {
    const out = headersForBase(headers, '/build/')
    expect(out).toContain('\n/build/assets/*\n')
    expect(out).not.toMatch(/^\/assets\/\*/m)
    expect(out.startsWith('/*\n')).toBe(true)
  })

  test('the real file has exactly one /assets/* rule to move', async () => {
    const real = await Bun.file(new URL('../../../public/_headers', import.meta.url)).text()
    expect(real.match(/^\/assets\/\*/gm)).toHaveLength(1)
  })
})

describe('shellForSite', () => {
  test('re-points the sitewide og:url and og:image at the site', async () => {
    const html = await Bun.file(new URL('../../../index.html', import.meta.url)).text()
    const out = shellForSite(html, ONE_DOMAIN)
    expect(out).toContain('content="https://salvageunion.io/build/"')
    expect(out).toContain('content="https://salvageunion.io/build/icon-512.png"')
    expect(out).not.toContain('intheunionnow.com/')
    expect(shellForSite(html, STANDALONE)).toBe(html)
  })
})

describe('appUrl', () => {
  test('a test build is at the root, as production is today', () => {
    expect(BASE_PATH).toBe('')
    expect(appUrl('/p/mech/abc', 'https://intheunionnow.com')).toBe(
      'https://intheunionnow.com/p/mech/abc'
    )
    expect(appRoot('https://intheunionnow.com/')).toBe('https://intheunionnow.com')
  })
})
