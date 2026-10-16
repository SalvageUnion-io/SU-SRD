import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG_FILES, SVG_FILES } from '../brand/files'

const ROOT = join(import.meta.dir, '../../../..')

describe('brand files', () => {
  test.each(Object.entries(SVG_FILES))('%s matches mark.ts (run `bun run brand`)', (path, svg) => {
    expect(readFileSync(join(ROOT, path), 'utf8')).toBe(svg)
  })

  test("srd's web manifest lists only icons `bun run brand` writes", () => {
    const manifest = JSON.parse(
      readFileSync(join(ROOT, 'apps/web/public/site.webmanifest'), 'utf8')
    )
    const written = new Set(PNG_FILES.map(([path]) => path))
    for (const { src } of manifest.icons as { src: string }[]) {
      expect(written).toContain(`apps/web/public${src}`)
    }
  })

  test('the manifest gives Android a maskable icon, so it is not shrunk onto a white disc', () => {
    const manifest = JSON.parse(
      readFileSync(join(ROOT, 'apps/web/public/site.webmanifest'), 'utf8')
    )
    const maskable = (manifest.icons as { sizes: string; purpose?: string }[])
      .filter((icon) => icon.purpose === 'maskable')
      .map((icon) => icon.sizes)
    expect(maskable).toEqual(['192x192', '512x512'])
  })
})
