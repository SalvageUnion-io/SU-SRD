import { describe, expect, test } from 'bun:test'
import { appRoot, appUrl, BASE_PATH } from '../appUrl'
import { basePathOf, headersForBase, SITE, siteUrl } from '../site'

/** ITUN at salvageunion.io/build (ADR-048, `site.ts`). */
describe('SITE', () => {
  test('is salvageunion.io/build', () => {
    expect(siteUrl()).toBe('https://salvageunion.io/build/')
    expect(basePathOf(SITE.base)).toBe('/build')
    expect(basePathOf('/')).toBe('')
  })

  test("the shell's sitewide og:url and og:image point there", async () => {
    const html = await Bun.file(new URL('../../../index.html', import.meta.url)).text()
    expect(html).toContain(`<meta property="og:url" content="${siteUrl()}" />`)
    expect(html).toContain(`content="${siteUrl()}og-image.png"`)
    expect(html).not.toContain('intheunionnow.com/')
  })
})

describe('headersForBase', () => {
  const headers = '/*\n  X-Frame-Options: DENY\n\n/assets/*\n  Cache-Control: immutable\n'

  test('leaves a root build’s file alone', () => {
    expect(headersForBase(headers, '/')).toBe(headers)
  })

  test('scopes the immutable rule to the base, and keeps the sitewide block', () => {
    const out = headersForBase(headers, SITE.base)
    expect(out).toContain('\n/build/assets/*\n')
    expect(out).not.toMatch(/^\/assets\/\*/m)
    expect(out.startsWith('/*\n')).toBe(true)
  })

  test('the real file has exactly one /assets/* rule to move', async () => {
    const real = await Bun.file(new URL('../../../public/_headers', import.meta.url)).text()
    expect(real.match(/^\/assets\/\*/gm)).toHaveLength(1)
  })
})

describe('appUrl', () => {
  test("joins origin, base and route; a test build's base is the root", () => {
    expect(BASE_PATH).toBe('')
    expect(appUrl('/p/mech/abc', 'https://salvageunion.io')).toBe(
      'https://salvageunion.io/p/mech/abc'
    )
    expect(appRoot('https://salvageunion.io/')).toBe('https://salvageunion.io')
  })
})
