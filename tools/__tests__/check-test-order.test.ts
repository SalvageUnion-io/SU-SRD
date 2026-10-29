import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { RunTests } from '../check-test-order'
import { checkWorkspace, main, orderLeaks, parseJunit, testWorkspaces } from '../check-test-order'

const root = mkdtempSync(join(tmpdir(), 'test-order-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

const write = (path: string, text = '') => {
  mkdirSync(join(root, path, '..'), { recursive: true })
  writeFileSync(join(root, path), text)
}

const xml = (cases: string[]) =>
  `<?xml version="1.0"?><testsuites><testsuite name="x">${cases.join('')}</testsuite></testsuites>`
const pass = (file: string, name: string, classname = '') =>
  `<testcase name="${name}" classname="${classname}" file="${file}" line="1" />`
const fail = (file: string, name: string) =>
  `<testcase name="${name}" classname="" file="${file}" line="1"><failure message="x">x</failure></testcase>`

describe('parseJunit', () => {
  test('keys each case by file, describe and name, and reads failures, errors and skips', () => {
    const r = parseJunit(
      xml([
        pass('a.test.ts', 'adds &amp; &quot;keeps&quot;', 'math'),
        fail('a.test.ts', 'breaks'),
        `<testcase name="crashes" classname="" file="a.test.ts"><error message="x" /></testcase>`,
        `<testcase name="later" classname="" file="a.test.ts"><skipped /></testcase>`,
      ])
    )
    expect([...r]).toEqual([
      ['a.test.ts > math > adds & "keeps"', true],
      ['a.test.ts > breaks', false],
      ['a.test.ts > crashes', false],
    ])
  })

  test('numbers a repeated id, and reads nothing from an empty report', () => {
    const r = parseJunit(xml([pass('e.test.ts', 'row'), pass('e.test.ts', 'row')]))
    expect([...r.keys()]).toEqual(['e.test.ts > row', 'e.test.ts > row [2]'])
    expect(parseJunit('').size).toBe(0)
  })
})

test('orderLeaks: passed forward, and failed or never ran reversed', () => {
  const forward = new Map([
    ['a', true],
    ['b', true],
    ['c', true],
    ['d', false],
  ])
  const reversed = new Map([
    ['a', true],
    ['b', false],
    ['d', false],
  ])
  expect(orderLeaks(forward, reversed)).toEqual(['b', 'c'])
})

// A workspace of three files. The fake runner passes every test unless the
// rule given says the order breaks it; `calls` records each order it ran.
write('ws/package.json', JSON.stringify({ scripts: { test: 'bun test' } }))
for (const f of ['a', 'b', 'c']) write(`ws/__tests__/${f}.test.ts`)
const fake = (breaks: (order: readonly string[], call: number) => string[]) => {
  const calls: string[][] = []
  const run: RunTests = async (_cwd, files, outfile) => {
    calls.push([...files])
    const broken = breaks(files, calls.length)
    writeFileSync(
      outfile,
      xml(files.map((f) => (broken.includes(f) ? fail(f, 'it') : pass(f, 'it'))))
    )
    return { code: broken.length ? 1 : 0, output: '' }
  }
  return { run, calls }
}
const reversedFirst = (order: readonly string[]) => order[0]?.includes('c.test') ?? false

describe('checkWorkspace', () => {
  test('runs path order, then reversed; no leak means no third run', async () => {
    const { run, calls } = fake(() => [])
    const r = await checkWorkspace('ws', { root, run })
    expect(r).toEqual({ dir: 'ws', tests: 3, leaks: [], flaky: [] })
    expect(calls).toEqual([
      ['./__tests__/a.test.ts', './__tests__/b.test.ts', './__tests__/c.test.ts'],
      ['./__tests__/c.test.ts', './__tests__/b.test.ts', './__tests__/a.test.ts'],
    ])
  })

  test('a leak that reproduces is reported; one that does not is flaky', async () => {
    const { run, calls } = fake((order, call) => {
      if (!reversedFirst(order)) return []
      return call === 2
        ? ['./__tests__/a.test.ts', './__tests__/b.test.ts']
        : ['./__tests__/a.test.ts']
    })
    const r = await checkWorkspace('ws', { root, run })
    expect(r.leaks).toEqual(['./__tests__/a.test.ts > it'])
    expect(r.flaky).toEqual(['./__tests__/b.test.ts > it'])
    expect(calls).toHaveLength(3)
  })

  test('a forward run that reports nothing is an error, not a pass', async () => {
    const run: RunTests = async () => ({ code: 1, output: 'SyntaxError: boom' })
    const r = await checkWorkspace('ws', { root, run })
    expect(r.error).toContain('SyntaxError: boom')
  })

  test('runs real bun by default', async () => {
    write('real/package.json', '{}')
    write(
      'real/__tests__/one.test.ts',
      "import { expect, test } from 'bun:test'\ntest('one', () => expect(1).toBe(1))\n"
    )
    const r = await checkWorkspace('real', { root })
    expect(r).toEqual({ dir: 'real', tests: 1, leaks: [], flaky: [] })
  })
})

test('testWorkspaces: every workspace whose manifest has a test script', () => {
  const repo = mkdtempSync(join(tmpdir(), 'test-order-repo-'))
  try {
    const at = (p: string, text: string) => {
      mkdirSync(join(repo, p, '..'), { recursive: true })
      writeFileSync(join(repo, p), text)
    }
    at('apps/web/package.json', JSON.stringify({ scripts: { test: 'bun test' } }))
    at('packages/types/package.json', JSON.stringify({ scripts: {} }))
    at('packages/broken/package.json', '{ not json')
    at('tools/package.json', JSON.stringify({ scripts: { test: 'bun test' } }))
    expect(testWorkspaces(repo)).toEqual(['apps/web', 'tools'])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

describe('main', () => {
  const capture = async (argv: string[], run: RunTests) => {
    const out: string[] = []
    const err: string[] = []
    const code = await main(argv, {
      root,
      run,
      log: (l) => out.push(l),
      error: (l) => err.push(l),
    })
    return { code, out: out.join('\n'), err: err.join('\n') }
  }

  test('passes when both orders agree', async () => {
    const r = await capture(['ws'], fake(() => []).run)
    expect(r).toMatchObject({ code: 0, out: '✓ ws: 3 tests pass in both file orders', err: '' })
  })

  test('fails on a leak, names it, and prints the flaky ones', async () => {
    const r = await capture(
      ['ws'],
      fake((order, call) =>
        !reversedFirst(order)
          ? []
          : call === 2
            ? ['./__tests__/a.test.ts', './__tests__/b.test.ts']
            : ['./__tests__/a.test.ts']
      ).run
    )
    expect(r.code).toBe(1)
    expect(r.err).toContain('✗ ws: 1 test(s) pass in path order and fail with the files reversed')
    expect(r.err).toContain('./__tests__/a.test.ts > it')
    expect(r.err).toContain('bun tools/check-test-order.ts <workspace>')
    expect(r.out).toContain('~ ws: ./__tests__/b.test.ts > it failed reversed once')
  })

  test('fails when a workspace reports no test; with no argument, checks every workspace', async () => {
    write('apps/solo/package.json', JSON.stringify({ scripts: { test: 'bun test' } }))
    write('apps/solo/__tests__/x.test.ts')
    const r = await capture([], async () => ({ code: 1, output: 'no tests' }))
    expect(r.code).toBe(1)
    expect(r.err).toContain('✗ apps/solo: no test reported in path order')
  })
})
