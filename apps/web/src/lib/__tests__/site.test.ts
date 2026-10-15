import { describe, expect, test } from 'bun:test'
import { renderShell } from '../../shell/shell'
import { appRoot, appUrl, BASE_PATH } from '../appUrl'
import { basePathOf, SITE } from '../site'

const siteUrl = `${SITE.origin}${SITE.base}`

/** The Cantina at salvageunion.io/build (ADR-048, `site.ts`). */
describe('SITE', () => {
  test('is salvageunion.io/build', () => {
    expect(siteUrl).toBe('https://salvageunion.io/build/')
    expect(basePathOf(SITE.base)).toBe('/build')
    expect(basePathOf('/')).toBe('')
  })

  test("the shell's sitewide og:url and og:image point there", () => {
    const html = renderShell()
    expect(html).toContain(`<meta property="og:url" content="${siteUrl}"/>`)
    expect(html).toContain(`content="${siteUrl}og-image.png"`)
    expect(html).not.toContain('intheunionnow.com/')
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
