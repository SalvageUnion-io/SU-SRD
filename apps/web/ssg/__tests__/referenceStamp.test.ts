import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { referenceStamp } from '../referenceStamp'

const roots: string[] = []

/** A package root with `lib/` and `data/`, each holding the given files. */
function packageRoot(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'ref-stamp-'))
  roots.push(root)
  for (const dir of ['lib', 'data', 'lib/__tests__'])
    mkdirSync(join(root, dir), { recursive: true })
  for (const [path, body] of Object.entries(files)) writeFileSync(join(root, path), body)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('referenceStamp', () => {
  test('is stable while nothing changes', () => {
    const root = packageRoot({ 'lib/fill.ts': 'a', 'data/classes.json': '[]' })
    expect(referenceStamp(root)).toBe(referenceStamp(root))
  })

  test('changes when a source file does', () => {
    const root = packageRoot({ 'lib/fill.ts': 'a', 'data/classes.json': '[]' })
    const before = referenceStamp(root)
    writeFileSync(join(root, 'lib/fill.ts'), 'class-hybrid')
    expect(referenceStamp(root)).not.toBe(before)
  })

  test('changes when a data file is touched', () => {
    const root = packageRoot({ 'lib/fill.ts': 'a', 'data/classes.json': '[]' })
    const before = referenceStamp(root)
    utimesSync(join(root, 'data/classes.json'), new Date(0), new Date(1_000_000))
    expect(referenceStamp(root)).not.toBe(before)
  })

  test('leaves tests out', () => {
    const root = packageRoot({ 'lib/fill.ts': 'a', 'lib/__tests__/fill.test.ts': 'x' })
    const before = referenceStamp(root)
    writeFileSync(join(root, 'lib/__tests__/fill.test.ts'), 'changed')
    expect(referenceStamp(root)).toBe(before)
  })
})
