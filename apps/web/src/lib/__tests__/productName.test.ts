import { describe, expect, test } from 'bun:test'
import { PRODUCT } from 'game-domain/product'
import { renderShell } from '../../shell/shell'
import { pageTitle } from '../pageTitle'

/**
 * The shell (`shell/shell.ts`) cannot import `PRODUCT`: the Vite config loads
 * it before any workspace package is. It spells the name as text, so this
 * holds it to the constant. `og:site_name` is the site's (`SITE_NAME`).
 */
const html = renderShell()

describe('the product name outside TypeScript', () => {
  test("the shell's title and sitewide meta name PRODUCT.name on the site", () => {
    const title = pageTitle(PRODUCT.name)
    expect(html).toContain(`<title>${title}</title>`)
    for (const property of ['og:title', 'og:image:alt']) {
      expect(html).toContain(`<meta property="${property}" content="${title}" />`)
    }
    expect(html).toContain(`<meta name="twitter:title" content="${title}" />`)
  })
})
