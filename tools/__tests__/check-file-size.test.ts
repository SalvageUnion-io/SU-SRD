import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  lineCount,
  MAX_LINES,
  main,
  OVER_BUDGET,
  scannedFiles,
  sizeProblems,
} from '../check-file-size'

const ROOT = join(import.meta.dir, '..', '..')
const temps: string[] = []

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'file-size-'))
  temps.push(root)
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), body)
  }
  return root
}

const lines = (n: number) => 'x\n'.repeat(n)

afterAll(() => {
  for (const t of temps) rmSync(t, { recursive: true, force: true })
})

describe('scannedFiles', () => {
  test('keeps shipped and tooling source; drops tests, stories, e2e, harnesses and generated', () => {
    expect(
      scannedFiles([
        'apps/srd/src/Card.tsx',
        'packages/a/lib/index.ts',
        'apps/srd/public/registerSW.js',
        'tools/check.ts',
        'apps/b/src/__tests__/Card.test.tsx',
        'apps/b/src/Card.stories.tsx',
        'apps/b/e2e/flow.e2e.ts',
        'apps/itun/test/convex/harness.ts',
        'apps/itun/convex/_generated/api.js',
        'packages/a/lib/generated/registry.ts',
        'apps/itun/src/routeTree.gen.ts',
        'apps/itun/src/env.d.ts',
        'apps/srd/src/styles.css',
      ])
    ).toEqual([
      'apps/srd/src/Card.tsx',
      'packages/a/lib/index.ts',
      'apps/srd/public/registerSW.js',
      'tools/check.ts',
    ])
  })
})

describe('lineCount', () => {
  test('counts as wc -l does, plus an unterminated last line', () => {
    expect(lineCount('')).toBe(0)
    expect(lineCount('a\nb\n')).toBe(2)
    expect(lineCount('a\nb')).toBe(2)
  })
})

describe('sizeProblems', () => {
  test('passes a file at the limit and fails one a line over it', () => {
    expect(sizeProblems(new Map([['a.ts', 600]]), {}, 600)).toEqual([])
    expect(sizeProblems(new Map([['a.ts', 601]]), {}, 600)).toEqual([
      'a.ts is 601 lines, over the 600-line limit. Split it into modules; never add an OVER_BUDGET entry.',
    ])
  })

  test('holds an over-budget file at its entry: it may never grow', () => {
    expect(sizeProblems(new Map([['big.ts', 900]]), { 'big.ts': 900 }, 600)).toEqual([])
    expect(sizeProblems(new Map([['big.ts', 901]]), { 'big.ts': 900 }, 600)).toEqual([
      'big.ts is 901 lines, over the 900 it is held at. Split it; never raise its OVER_BUDGET entry.',
    ])
  })

  test('fails a shrink the entry does not record, so the ratchet clicks', () => {
    expect(sizeProblems(new Map([['big.ts', 850]]), { 'big.ts': 900 }, 600)).toEqual([
      'big.ts is 850 lines, under the 900 it is held at. Lower its OVER_BUDGET entry to 850.',
    ])
    expect(sizeProblems(new Map([['big.ts', 601]]), { 'big.ts': 900 }, 600)).toEqual([
      'big.ts is 601 lines, under the 900 it is held at. Lower its OVER_BUDGET entry to 601.',
    ])
  })

  test('fails an entry whose file is gone or now within the limit', () => {
    expect(sizeProblems(new Map(), { 'gone.ts': 700 }, 600)).toEqual([
      'OVER_BUDGET names gone.ts, which is not a scanned file. Delete the entry.',
    ])
    expect(sizeProblems(new Map([['split.ts', 600]]), { 'split.ts': 700 }, 600)).toEqual([
      'split.ts is 600 lines, within the 600-line limit. Delete its OVER_BUDGET entry (700).',
    ])
  })
})

describe('main', () => {
  test('reads the tree and reports each problem', () => {
    const root = tree({
      'apps/a/src/ok.ts': lines(MAX_LINES),
      'apps/a/src/big.ts': lines(MAX_LINES + 1),
      'apps/a/src/__tests__/long.test.ts': lines(MAX_LINES * 3),
    })
    const paths = ['apps/a/src/ok.ts', 'apps/a/src/big.ts', 'apps/a/src/__tests__/long.test.ts']
    const errors: string[] = []
    expect(
      main(
        root,
        paths,
        () => {},
        (m) => errors.push(m),
        {},
        1
      )
    ).toBe(1)
    expect(errors).toEqual([
      'check-file-size: 1 problem(s):',
      `  apps/a/src/big.ts is ${MAX_LINES + 1} lines, over the ${MAX_LINES}-line limit. Split it into modules; never add an OVER_BUDGET entry.`,
    ])
    const logs: string[] = []
    expect(
      main(
        root,
        ['apps/a/src/ok.ts'],
        (m) => logs.push(m),
        () => {},
        {},
        1
      )
    ).toBe(0)
    expect(logs[0]).toContain('1 source files within')
  })

  test('every OVER_BUDGET entry names a file in the repo, still over the limit', () => {
    for (const [path, budget] of Object.entries(OVER_BUDGET)) {
      expect(existsSync(join(ROOT, path))).toBe(true)
      expect(budget).toBeGreaterThan(MAX_LINES)
    }
  })
})
