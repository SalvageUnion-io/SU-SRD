import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  main,
  preloadDrift,
  readPreload,
  siblingTests,
  workspacePreloads,
} from '../check-test-layout'

const ROOT = join(import.meta.dir, '..', '..')
const temps: string[] = []

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'test-layout-'))
  temps.push(root)
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), body)
  }
  return root
}

afterAll(() => {
  for (const t of temps) rmSync(t, { recursive: true, force: true })
})

describe('siblingTests', () => {
  test('flags a test with no __tests__ directory in its path, and nothing else', () => {
    expect(
      siblingTests([
        'packages/a/lib/foo.test.ts',
        'packages/a/lib/__tests__/bar.test.ts',
        'apps/b/src/x/__tests__/deep/baz.test.tsx',
        'apps/b/src/Card.tsx',
        'apps/b/e2e/flow.e2e.ts',
        'apps/b/src/View.test.tsx',
      ])
    ).toEqual(['packages/a/lib/foo.test.ts', 'apps/b/src/View.test.tsx'])
  })
})

describe('readPreload', () => {
  test('reads a list, a single string, or none', () => {
    expect(readPreload('[test]\npreload = ["./a.ts", "./b.ts"]')).toEqual(['./a.ts', './b.ts'])
    expect(readPreload('[test]\npreload = "./a.ts"')).toEqual(['./a.ts'])
    expect(readPreload('[install]\nexact = true')).toEqual([])
  })
})

describe('preloadDrift', () => {
  const workspaces = [
    { dir: 'apps/x', preload: ['./test/env.ts', '../../test/dom.ts', './test/stub.ts'] },
    { dir: 'packages/y', preload: ['../../test/dom.ts'] },
  ]

  test('passes the exact union, each workspace in its own order', () => {
    expect(
      preloadDrift(
        '/r',
        ['./apps/x/test/env.ts', './test/dom.ts', './apps/x/test/stub.ts'],
        workspaces
      )
    ).toEqual([])
  })

  test('names a missing preload, an extra one and a reordered workspace', () => {
    expect(
      preloadDrift('/r', ['./test/dom.ts', './apps/x/test/env.ts', './test/gone.ts'], workspaces)
    ).toEqual([
      'root preload is missing ./apps/x/test/stub.ts (from apps/x/bunfig.toml)',
      "root preload reorders apps/x/bunfig.toml's: apps/x/test/env.ts, test/dom.ts",
      'root preload lists ./test/gone.ts, which no workspace preloads',
    ])
  })
})

describe('workspacePreloads', () => {
  test('reads apps/*, packages/* and tools bunfigs, skipping a workspace without one', () => {
    const root = tree({
      'apps/b/bunfig.toml': '[test]\npreload = ["../../test/dom.ts"]',
      'apps/a/bunfig.toml': '[test]\ncoveragePathIgnorePatterns = ["../**"]',
      'apps/c/package.json': '{}',
      'packages/p/bunfig.toml': '[test]\npreload = "./x.ts"',
      'tools/bunfig.toml': '[test]',
    })
    expect(workspacePreloads(root)).toEqual([
      { dir: 'apps/a', preload: [] },
      { dir: 'apps/b', preload: ['../../test/dom.ts'] },
      { dir: 'packages/p', preload: ['./x.ts'] },
      { dir: 'tools', preload: [] },
    ])
  })
})

describe('main', () => {
  const quiet = () => {}
  const manyTests = Array.from({ length: 400 }, (_, i) => `apps/a/src/__tests__/t${i}.test.ts`)

  test('passes the real repo: its root preload matches the workspaces', () => {
    const logs: string[] = []
    expect(main(ROOT, manyTests, (m) => logs.push(m), quiet)).toBe(0)
    expect(logs[0]).toContain('400 test files sit in __tests__/')
  })

  test('fails a sibling test and a drifted root preload, naming both', () => {
    const root = tree({
      'bunfig.toml': '[test]\npreload = []',
      'apps/a/bunfig.toml': '[test]\npreload = ["./test/stub.ts"]',
    })
    const errors: string[] = []
    expect(
      main(root, [...manyTests, 'apps/a/src/Card.test.tsx'], quiet, (m) => errors.push(m))
    ).toBe(1)
    expect(errors).toEqual([
      'check-test-layout: 2 problem(s):',
      '  apps/a/src/Card.test.tsx is outside a __tests__/ directory',
      '  root preload is missing ./apps/a/test/stub.ts (from apps/a/bunfig.toml)',
    ])
  })
})
