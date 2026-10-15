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
      readFileSync(join(ROOT, 'apps/srd/public/site.webmanifest'), 'utf8')
    )
    const written = new Set(PNG_FILES.map(([path]) => path))
    for (const { src } of manifest.icons as { src: string }[]) {
      expect(written).toContain(`apps/srd/public${src}`)
    }
  })
})
