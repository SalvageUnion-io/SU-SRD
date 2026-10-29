import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  listedPaths,
  main,
  scriptDrift,
  siblingTests,
  strayTests,
  TEST_SCRIPT,
  workspaceTestScripts,
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

const manifest = (test?: string) => JSON.stringify({ scripts: test ? { test } : {} })

afterAll(() => {
  for (const t of temps) rmSync(t, { recursive: true, force: true })
})

describe('strayTests', () => {
  test('flags every name bun test runs that is not *.test.ts(x)', () => {
    expect(
      strayTests([
        'apps/b/src/__tests__/a.spec.ts',
        'apps/b/src/__tests__/b_test.ts',
        'apps/b/src/__tests__/c.test.mts',
        'apps/b/src/__tests__/d.test.ts',
        'apps/b/src/__tests__/e.test.tsx',
        'apps/b/e2e/flow.e2e.ts',
        'apps/b/src/spec.ts',
      ])
    ).toEqual([
      'apps/b/src/__tests__/a.spec.ts',
      'apps/b/src/__tests__/b_test.ts',
      'apps/b/src/__tests__/c.test.mts',
    ])
  })
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

describe('workspaceTestScripts', () => {
  test('reads apps/*, packages/* and tools manifests, skipping a directory without one', () => {
    const root = tree({
      'apps/b/package.json': manifest('bun test'),
      'apps/a/package.json': manifest(TEST_SCRIPT),
      'apps/c/README.md': '',
      'packages/p/package.json': manifest(),
      'tools/package.json': manifest(TEST_SCRIPT),
    })
    expect(workspaceTestScripts(root)).toEqual([
      { dir: 'apps/a', script: TEST_SCRIPT },
      { dir: 'apps/b', script: 'bun test' },
      { dir: 'packages/p', script: undefined },
      { dir: 'tools', script: TEST_SCRIPT },
    ])
  })
})

describe('scriptDrift', () => {
  test('names every other form, and passes the one script or none', () => {
    expect(
      scriptDrift([
        { dir: 'apps/a', script: TEST_SCRIPT },
        { dir: 'apps/b', script: 'bun test' },
        { dir: 'apps/c', script: 'bun test --parallel' },
        { dir: 'packages/p', script: undefined },
      ])
    ).toEqual([
      `apps/b/package.json's test script is "bun test"`,
      `apps/c/package.json's test script is "bun test --parallel"`,
    ])
  })
})

describe('main', () => {
  const quiet = () => {}
  const manyTests = Array.from({ length: 400 }, (_, i) => `apps/a/src/__tests__/t${i}.test.ts`)

  test('passes the real repo: every workspace uses the one test script', () => {
    const logs: string[] = []
    expect(main(ROOT, manyTests, (m) => logs.push(m), quiet)).toBe(0)
    expect(logs[0]).toContain('400 test files sit in __tests__/')
    expect(logs[0]).toContain(TEST_SCRIPT)
  })

  test('fails a sibling test and a second test-script form, naming both', () => {
    const root = tree({
      'apps/a/package.json': manifest('bun test'),
      'packages/p/package.json': manifest(TEST_SCRIPT),
    })
    const errors: string[] = []
    expect(
      main(root, [...manyTests, 'apps/a/src/Card.test.tsx'], quiet, (m) => errors.push(m))
    ).toBe(1)
    expect(errors).toEqual([
      'check-test-layout: 2 problem(s):',
      '  apps/a/src/Card.test.tsx is outside a __tests__/ directory',
      `  apps/a/package.json's test script is "bun test"`,
    ])
  })
})

describe('listedPaths', () => {
  test("lists the repository's files, each one present on disk", async () => {
    const paths = await listedPaths()
    expect(paths).toContain('package.json')
    expect(paths).toContain('tools/check-test-layout.ts')
    expect(paths.every((p) => p.length > 0 && !p.startsWith('/'))).toBe(true)
  })
})
