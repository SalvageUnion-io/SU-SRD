import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lcovFor, main, runJob, shardTestFiles } from '../run-coverage'

const root = mkdtempSync(join(tmpdir(), 'run-coverage-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

const write = (path: string, text = '') => {
  mkdirSync(join(root, path, '..'), { recursive: true })
  writeFileSync(join(root, path), text)
}

// A stand-in for `bun`: `test --coverage-dir=<dir> [files…]` writes one lcov
// record to <dir>/lcov.info. Line 2 is hit only by a run given b.test.ts, so a
// shard merge must take it from whichever shard ran that file. STUB_EXIT and
// STUB_NO_LCOV (read from the workspace's own files) make it fail or skip.
write(
  'stub.ts',
  `import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
const args = process.argv.slice(3)
if (existsSync('STUB_EXIT')) { console.log('stub broke'); process.exit(3) }
const dir = args.find((a) => a.startsWith('--coverage-dir='))?.slice(15) ?? 'coverage'
const files = args.filter((a) => a.startsWith('./'))
console.log('stub ran ' + (files.join(' ') || 'everything'))
if (existsSync('STUB_NO_LCOV')) process.exit(0)
const b = files.length === 0 || files.includes('./b.test.ts') ? 1 : 0
mkdirSync(dir, { recursive: true })
writeFileSync(dir + '/lcov.info', ['TN:', 'SF:src.ts', 'FNF:1', 'FNH:1', 'DA:1,1', 'DA:2,' + b, 'LF:2', 'LH:' + (b + 1), 'end_of_record', ''].join('\\n'))
`
)
const bun = [process.execPath, join(root, 'stub.ts')]

describe('shardTestFiles', () => {
  test('deals test files round-robin in path order, skipping node_modules and dot dirs', () => {
    for (const path of [
      'deal/c.test.ts',
      'deal/a.test.tsx',
      'deal/b_spec.js',
      'deal/sub/d.spec.ts',
      'deal/e.ts',
      'deal/node_modules/x.test.ts',
      'deal/.cache/y.test.ts',
    ])
      write(path)
    expect(shardTestFiles(join(root, 'deal'), 2)).toEqual([
      ['./a.test.tsx', './c.test.ts'],
      ['./b_spec.js', './sub/d.spec.ts'],
    ])
  })
})

describe('runJob', () => {
  for (const path of ['ws/a.test.ts', 'ws/b.test.ts', 'ws/c.test.ts']) write(path)
  const job = (floor: number, shards?: number) => runJob('ws', floor, { root, shards, bun })

  test('one process: line coverage of its lcov against the floor', async () => {
    const pass = await job(100)
    expect(pass.ok).toBe(true)
    expect(pass.verdict).toStartWith('100.00% of lines, floor 100%, tests passed')
    expect(pass.output).toContain('stub ran everything')
  })

  test('shards: each runs its files, and the merged lcov is what the floor reads', async () => {
    write('ws/coverage/lcov.info', 'stale')
    const result = await job(100, 2)
    expect(result.ok).toBe(true)
    expect(result.verdict).toEndWith('(2 shards)')
    expect(result.output).toContain('── shard 1/2 ──\nstub ran ./a.test.ts ./c.test.ts')
    expect(result.output).toContain('── shard 2/2 ──\nstub ran ./b.test.ts')
    const merged = readFileSync(join(root, 'ws/coverage/lcov.info'), 'utf-8')
    expect(merged).toContain('DA:2,1\nLF:2\nLH:2\n')
  })

  test('below the floor fails, naming it', async () => {
    rmSync(join(root, 'ws/b.test.ts'))
    const result = await job(60, 2)
    expect(result.ok).toBe(false)
    expect(result.verdict).toStartWith('50.00% of lines, floor 60% (BELOW FLOOR)')
    write('ws/b.test.ts')
  })

  test('a failing run fails the job with its exit code, and nothing is merged', async () => {
    write('ws/STUB_EXIT')
    const result = await job(0, 2)
    rmSync(join(root, 'ws/STUB_EXIT'))
    expect(result.ok).toBe(false)
    expect(result.verdict).toStartWith('TESTS FAILED (exit 3)')
    expect(result.output).toContain('stub broke')
    expect(existsSync(join(root, 'ws/coverage/lcov.info'))).toBe(false)
  })

  test('passing tests with no lcov is a failure, not a pass', async () => {
    write('ws/STUB_NO_LCOV')
    const sharded = await job(0, 2)
    const single = await job(0)
    rmSync(join(root, 'ws/STUB_NO_LCOV'))
    for (const result of [sharded, single]) {
      expect(result.ok).toBe(false)
      expect(result.verdict).toStartWith('NO COVERAGE')
    }
  })
})

describe('a part', () => {
  const record = (source: string, hit: number) =>
    ['TN:', `SF:${source}`, `DA:1,${hit}`, 'LF:1', `LH:${hit}`, 'end_of_record', ''].join('\n')

  test('lcovFor keeps only the records whose source it owns', () => {
    const lcov = record('src/cantina/a.ts', 1) + record('src/b.ts', 0)
    expect(lcovFor(lcov, (path) => path.startsWith('src/cantina/'))).toBe(
      record('src/cantina/a.ts', 1)
    )
    expect(lcovFor(lcov, () => false)).toBe('')
  })

  test('runs only its own test files, into its own coverage folder, scored on its own sources', async () => {
    for (const path of ['pw/a.test.ts', 'pw/b.test.ts']) write(path)
    const part = { dir: 'pw', owns: (path: string) => path !== 'a.test.ts' }
    const result = await runJob('pw (b)', 100, { root, bun, part })
    expect(result.ok).toBe(true)
    expect(result.output).toContain('stub ran ./b.test.ts')
    expect(readFileSync(join(root, 'pw/coverage/pw-b-/lcov.info'), 'utf-8')).toContain('SF:src.ts')
    const none = await runJob('pw (none)', 0, {
      root,
      bun,
      part: { dir: 'pw', owns: (path) => path.endsWith('.test.ts') },
    })
    expect(none.ok).toBe(false)
    expect(none.verdict).toStartWith('NO COVERAGE')
  })
})

describe('main', () => {
  for (const path of [
    'm-pass/a.test.ts',
    'm-pass/b.test.ts',
    'm-also/a.test.ts',
    'm-broken/a.test.ts',
    'm-broken/STUB_EXIT',
  ])
    write(path)
  const run = async (floors: Record<string, number>) => {
    const logged: string[] = []
    const covered: string[][] = []
    const summaryPath = join(root, `summary-${Object.keys(floors).join('-')}.md`)
    const code = await main({
      floors,
      shards: { 'm-pass': 2 },
      root,
      bun,
      coversWorkspaces: (names) => covered.push(names),
      summaryPath,
      log: (t) => logged.push(t),
    })
    return { code, logged, covered, summary: readFileSync(summaryPath, 'utf8') }
  }

  test('runs every workspace, prints each output whole, then an aligned summary', async () => {
    const r = await run({ 'm-pass': 100, 'm-also': 0 })
    expect(r.code).toBe(0)
    expect(r.covered).toEqual([['m-pass', 'm-also']])
    expect(r.logged.slice(0, 2).sort()).toEqual([
      expect.stringMatching(/^\n━━━━ m-also: 100\.00% of lines.*\nstub ran everything$/),
      expect.stringMatching(
        /^\n━━━━ m-pass: 100\.00% of lines.*── shard 2\/2 ──\nstub ran \.\/b\.test\.ts$/s
      ),
    ])
    const summary = r.logged.at(-1) ?? ''
    expect(summary).toMatch(
      /^\n✓ m-pass {2}100\.00% of lines, floor 100%.*\(2 shards\)\n✓ m-also {2}100\.00% of lines/
    )
    expect(r.summary).toBe(`## Tests and coverage\n\n\`\`\`\n${summary.slice(1)}\n\`\`\`\n`)
  })

  test('one workspace under its floor fails the run', async () => {
    const r = await run({ 'm-also': 0, 'm-broken': 0 })
    expect(r.code).toBe(1)
    expect(r.logged.at(-1)).toMatch(/\n✗ m-broken {2}TESTS FAILED \(exit 3\)/)
  })
})
