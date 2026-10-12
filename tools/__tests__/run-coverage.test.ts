import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runJob, shardTestFiles } from '../run-coverage'

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
