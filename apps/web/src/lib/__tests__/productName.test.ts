import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PRODUCT } from 'cantina-domain/product'
import { renderShell } from '../../shell/shell'

/**
 * The shell (`shell/shell.ts`) and `public/build/favicon.svg` cannot import
 * `PRODUCT`: the SVG is static, and the shell is loaded by the Vite config
 * before any workspace package is. They spell the name as text, so
 * this holds them to the constant.
 */
const workspace = join(import.meta.dir, '..', '..', '..')
const html = renderShell()
const favicon = readFileSync(join(workspace, 'public', 'build', 'favicon.svg'), 'utf8')

describe('the product name outside TypeScript', () => {
  test("the shell's title and sitewide meta say PRODUCT.name", () => {
    expect(html).toContain(`<title>${PRODUCT.name}</title>`)
    for (const property of ['og:site_name', 'og:title', 'og:image:alt']) {
      expect(html).toContain(`<meta property="${property}" content="${PRODUCT.name}"/>`)
    }
    expect(html).toContain(`<meta name="twitter:title" content="${PRODUCT.name}"/>`)
  })

  test("the favicon's title says PRODUCT.name", () => {
    expect(favicon).toContain(`<title>${PRODUCT.name}</title>`)
  })
})
