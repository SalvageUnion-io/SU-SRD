import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { functionRanges } from '../lib/functionRanges'
import type { FunctionRange } from '../lib/lcov'
import { mergeLcov } from '../lib/lcov'

/** Each file's `LF` and `LH` as recorded, for comparing two lcov reports. */
function lineTotalsByFile(lcov: string): Map<string, { found: number; hit: number }> {
  const totals = new Map<string, { found: number; hit: number }>()
  let path = ''
  for (const line of lcov.split('\n')) {
    if (line.startsWith('SF:')) path = line.slice(3)
    else if (line.startsWith('LF:')) totals.set(path, { found: Number(line.slice(3)), hit: 0 })
    else if (line.startsWith('LH:')) {
      const entry = totals.get(path)
      if (entry) entry.hit = Number(line.slice(3))
    }
  }
  return totals
}

/** One Bun-shaped lcov record: `DA` per entry of `lines` (line → hits). */
function record(path: string, lines: Record<number, number>, fn = { found: 1, hit: 1 }): string {
  const das = Object.entries(lines).map(([at, hits]) => `DA:${at},${hits}`)
  const hit = Object.values(lines).filter((hits) => hits > 0).length
  return [
    'TN:',
    `SF:${path}`,
    `FNF:${fn.found}`,
    `FNH:${fn.hit}`,
    ...das,
    `LF:${das.length}`,
    `LH:${hit}`,
    'end_of_record',
    '',
  ].join('\n')
}

/** The merged file's `DA` lines as line → hits. */
function linesOf(lcov: string, path: string): Record<number, number> {
  const body = lcov.slice(
    lcov.indexOf(`SF:${path}\n`),
    lcov.indexOf('end_of_record', lcov.indexOf(`SF:${path}\n`))
  )
  return Object.fromEntries(
    [...body.matchAll(/^DA:(\d+),(\d+)$/gm)].map(([, at, hits]) => [Number(at), Number(hits)])
  )
}

const merge = (runs: Record<number, number>[], functions: FunctionRange[]) =>
  mergeLcov(
    runs.map((lines) => record('a.ts', lines)),
    () => functions
  )

describe('mergeLcov', () => {
  test('runs that agree on the lines keep them, at the most hits, without parsing', () => {
    const merged = mergeLcov(
      [record('a.ts', { 1: 2, 2: 0, 3: 0 }), record('a.ts', { 1: 5, 2: 1, 3: 0 })],
      () => {
        throw new Error('parsed a file the runs agree on')
      }
    )
    expect(linesOf(merged, 'a.ts')).toEqual({ 1: 5, 2: 1, 3: 0 })
    expect(lineTotalsByFile(merged).get('a.ts')).toEqual({ found: 3, hit: 2 })
  })

  test('a file only one run loaded passes through, files sorted', () => {
    const merged = mergeLcov([record('b.ts', { 4: 1 }), record('a.ts', { 1: 0 })], () => [])
    expect([...lineTotalsByFile(merged).keys()]).toEqual(['a.ts', 'b.ts'])
    expect(lineTotalsByFile(merged).get('b.ts')).toEqual({ found: 1, hit: 1 })
  })

  test("an executed function's code lines win over another run's 0-hit range", () => {
    // Function on lines 10-20. Run 1 called it: code lines only, the unrun
    // branch at 16 included, the last statement at 19 too. Run 2 never did:
    // 10-18 at 0, comments 12-14 included, 19 left out, and a stray source-map
    // hit on 18 that must not make it look executed.
    const merged = merge(
      [
        { 1: 1, 10: 5, 11: 5, 15: 5, 16: 0, 19: 5 },
        { 1: 1, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0, 15: 0, 16: 0, 17: 0, 18: 1 },
      ],
      [[10, 20]]
    )
    expect(linesOf(merged, 'a.ts')).toEqual({ 1: 1, 10: 5, 11: 5, 15: 5, 16: 0, 19: 5 })
  })

  test('a function no run executed keeps the range every run reports', () => {
    const merged = merge(
      [
        { 1: 1, 10: 0, 11: 0, 12: 0 },
        { 1: 2, 10: 0, 11: 0, 12: 0, 30: 1 },
      ],
      [[10, 14]]
    )
    expect(lineTotalsByFile(merged).get('a.ts')).toEqual({ found: 5, hit: 2 })
  })

  test('an uncalled closure inside a called function is not reported as a range', () => {
    // Parent 10-20 ran in run 1, where its uncalled closure on 13-16 (a body of
    // comments) adds no lines. Run 2 never ran the parent: 11-19 at 0.
    const merged = merge(
      [
        { 1: 1, 11: 3, 12: 3, 13: 3, 16: 3, 17: 3 },
        { 1: 1, 11: 0, 12: 0, 13: 0, 14: 0, 15: 0, 16: 0, 17: 0, 18: 0, 19: 0 },
      ],
      [
        [10, 20],
        [13, 16],
      ]
    )
    expect(Object.keys(linesOf(merged, 'a.ts')).map(Number)).toEqual([1, 11, 12, 13, 16, 17])
  })

  test('a module one run stopped evaluating part-way takes the full run', () => {
    const merged = merge(
      [
        { 1: 3, 3: 3, 5: 3 },
        { 1: 3, 3: 0, 4: 0, 5: 0 },
      ],
      []
    )
    expect(linesOf(merged, 'a.ts')).toEqual({ 1: 3, 3: 3, 5: 3 })
  })

  test("a sibling's 0-hit range spilling into the gap before it does not count", () => {
    // Parent 1-30 ran in both. Methods 5-9 and 11-15; run 2 never called the
    // second, whose range Bun starts on the gap line 10.
    const merged = merge(
      [
        { 2: 1, 5: 1, 6: 1, 8: 1, 11: 1, 12: 1, 14: 1 },
        { 2: 1, 5: 1, 6: 1, 8: 1, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0 },
      ],
      [
        [1, 30],
        [5, 9],
        [11, 15],
      ]
    )
    expect(linesOf(merged, 'a.ts')).toEqual({ 2: 1, 5: 1, 6: 1, 8: 1, 11: 1, 12: 1, 14: 1 })
  })

  test('function totals take the largest per-run value', () => {
    const merged = mergeLcov(
      [
        record('a.ts', { 1: 1 }, { found: 4, hit: 1 }),
        record('a.ts', { 1: 1 }, { found: 4, hit: 3 }),
      ],
      () => []
    )
    expect(merged).toContain('FNF:4\nFNH:3\n')
  })
})

describe('functionRanges', () => {
  test('finds declarations, expressions, arrows and methods in TSX', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lcov-'))
    try {
      const path = join(dir, 'a.tsx')
      writeFileSync(
        path,
        [
          'export function A({ x }: { x: number }) {', // 1
          '  const on = () => {', // 2
          '    x++', // 3
          '  }', // 4
          '  return <b onClick={() => on()}>{x}</b>', // 5
          '}', // 6
          'const o = {', // 7
          '  m() {', // 8
          '    return function () {}', // 9
          '  },', // 10
          '}', // 11
        ].join('\n')
      )
      expect(functionRanges(path).sort(([a], [b]) => a - b)).toEqual([
        [1, 6],
        [2, 4],
        [5, 5],
        [8, 10],
        [9, 9],
      ])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
