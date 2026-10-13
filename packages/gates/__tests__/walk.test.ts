import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { walk } from '../lib/walk'

const root = mkdtempSync(join(tmpdir(), 'walk-'))

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
})

for (const path of ['a.ts', 'src/b.tsx', 'src/c.md', 'node_modules/d.ts', 'src/_generated/e.ts']) {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), '')
}

const isTs = (path: string) => /\.tsx?$/.test(path)
const relative = (paths: string[]) => paths.map((p) => p.slice(root.length + 1)).sort()

describe('walk', () => {
  test('returns the kept files as absolute paths, skipping node_modules by default', () => {
    expect(relative(walk(root, isTs))).toEqual(['a.ts', 'src/_generated/e.ts', 'src/b.tsx'])
  })

  test('skips every directory named in `skip`', () => {
    const skip = new Set(['node_modules', '_generated'])
    expect(relative(walk(root, isTs, skip))).toEqual(['a.ts', 'src/b.tsx'])
  })

  test('a missing directory yields no files', () => {
    expect(walk(join(root, 'gone'), isTs)).toEqual([])
  })
})
