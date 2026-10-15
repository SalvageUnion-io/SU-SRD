import { describe, expect, test } from 'bun:test'
import { PRODUCT } from 'cantina-domain/product'
import { renderShell } from '../../shell/shell'

/**
 * The shell (`shell/shell.ts`) cannot import `PRODUCT`: the Vite config loads
 * it before any workspace package is. It spells the name as text, so this
 * holds it to the constant. `og:site_name` is the site's (`SITE_NAME`).
 */
const html = renderShell()

describe('the product name outside TypeScript', () => {
  test("the shell's title and sitewide meta say PRODUCT.name", () => {
    expect(html).toContain(`<title>${PRODUCT.name}</title>`)
    for (const property of ['og:title', 'og:image:alt']) {
      expect(html).toContain(`<meta property="${property}" content="${PRODUCT.name}" />`)
    }
    expect(html).toContain(`<meta name="twitter:title" content="${PRODUCT.name}" />`)
  })
})
