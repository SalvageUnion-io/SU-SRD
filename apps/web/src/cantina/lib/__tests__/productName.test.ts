import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PRODUCT } from 'component-lib/product'

/**
 * `index.html`, `public/favicon.svg` and the PWA manifest in `vite.cantina.config.ts`
 * cannot import `PRODUCT`: the HTML and SVG are static, and the config is
 * loaded before any workspace TypeScript is. They spell the name as text, so this
 * holds them to the constant. Read as text: importing `vite.cantina.config.ts` would
 * load every Vite plugin.
 */
const appDir = join(import.meta.dir, '..', '..')
const workspace = join(appDir, '..', '..')
const html = readFileSync(join(appDir, 'index.html'), 'utf8')
const config = readFileSync(join(workspace, 'vite.cantina.config.ts'), 'utf8')
const favicon = readFileSync(join(appDir, 'public', 'favicon.svg'), 'utf8')

describe('the product name outside TypeScript', () => {
  test("index.html's title and sitewide meta say PRODUCT.name", () => {
    expect(html).toContain(`<title>${PRODUCT.name}</title>`)
    for (const property of ['og:site_name', 'og:title', 'og:image:alt']) {
      expect(html).toContain(`<meta property="${property}" content="${PRODUCT.name}" />`)
    }
    expect(html).toContain(`<meta name="twitter:title" content="${PRODUCT.name}" />`)
  })

  test("the favicon's title says PRODUCT.name", () => {
    expect(favicon).toContain(`<title>${PRODUCT.name}</title>`)
  })

  test("the manifest's name and short name are PRODUCT's", () => {
    expect(config).toContain(`name: '${PRODUCT.name} — ${PRODUCT.descriptor}',`)
    expect(config).toContain(`short_name: '${PRODUCT.shortName}',`)
  })
})
