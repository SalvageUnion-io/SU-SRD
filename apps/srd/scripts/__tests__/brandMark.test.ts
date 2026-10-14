import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SVG_FILES } from '../brand/build'

const ROOT = join(import.meta.dir, '../../../..')

describe('brand files', () => {
  test.each(Object.entries(SVG_FILES))('%s matches mark.ts (run `bun run brand`)', (path, svg) => {
    expect(readFileSync(join(ROOT, path), 'utf8')).toBe(svg)
  })
})
