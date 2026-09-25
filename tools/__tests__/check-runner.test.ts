import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import type { CheckSpec } from '../check'
import { CHECKS, formatTable, parseArgs, runChecks, selectChecks, UsageError } from '../check'

/**
 * `tools/check.ts` is the one list of gates that `bun run check`, pre-push and
 * CI all run. These pin the selection rules — a check dropped from a profile is
 * a check some path silently stops running — and the runner's exit semantics.
 */

const ids = (argv: string[]) => selectChecks(CHECKS, parseArgs(argv)).map((c) => c.id)

describe('selection', () => {
  test('full runs every registered check', () => {
    expect(ids([])).toEqual(CHECKS.map((c) => c.id))
  })

  test('generated runs first, before anything that reads what it writes', () => {
    expect(CHECKS.filter((c) => c.first).map((c) => c.id)).toEqual(['generated'])
  })

  test('fast skips the suite, the srd build, the network and regeneration', () => {
    const fast = ids(['--profile=fast'])
    for (const slow of ['test', 'srd-output', 'audit', 'actionlint', 'generated']) {
      expect(fast).not.toContain(slow)
    }
    expect(fast).toContain('typecheck')
    expect(ids(['--fast'])).toEqual(fast)
  })

  test('pre-push is fast plus generated-file drift, and now includes the workflow gate', () => {
    expect(ids(['--profile=pre-push']).sort()).toEqual(
      [...ids(['--profile=fast']), 'generated'].sort()
    )
    expect(ids(['--profile=pre-push'])).toContain('workflows')
  })

  test('ci leaves the suite and the srd build to their own jobs', () => {
    const ci = ids(['--profile=ci'])
    expect(ci).not.toContain('test')
    expect(ci).not.toContain('srd-output')
    expect(ci).toContain('audit')
    expect(ci).toContain('actionlint')
  })

  test('a docs-only change runs the always-on checks and the repo invariants, not code-only ones', () => {
    const docs = ids(['--profile=ci', '--areas=docs'])
    expect(docs).toContain('doc-drift')
    expect(docs).toContain('data')
    expect(docs).toContain('biome')
    expect(docs).not.toContain('typecheck')
    expect(docs).not.toContain('generated')
  })

  test('with no area active only the always-on checks run', () => {
    expect(ids(['--profile=ci', '--areas='])).toEqual([
      'biome',
      'workflows',
      'styling',
      'actionlint',
    ])
  })

  test('positional ids override the profile; --skip removes', () => {
    expect(ids(['audit', 'styling'])).toEqual(['styling', 'audit'])
    expect(ids(['--skip=test,srd-output'])).not.toContain('test')
  })

  test('unknown ids, profiles, areas and flags are usage errors', () => {
    expect(() => parseArgs(['nope'])).toThrow(UsageError)
    expect(() => parseArgs(['--skip=nope'])).toThrow(UsageError)
    expect(() => parseArgs(['--profile=quick'])).toThrow(UsageError)
    expect(() => parseArgs(['--areas=web'])).toThrow(UsageError)
    expect(() => parseArgs(['--jobs=0'])).toThrow(UsageError)
    expect(() => parseArgs(['--frobnicate'])).toThrow(UsageError)
  })
})

describe('registry', () => {
  test('every command points at something that exists', async () => {
    const root = join(import.meta.dir, '..', '..')
    for (const c of CHECKS) {
      const script = c.cmd.find((part) => /\.(ts|sh)$/.test(part))
      if (!script) continue
      expect({
        id: c.id,
        exists: await Bun.file(join(root, c.cwd ?? '.', script)).exists(),
      }).toEqual({
        id: c.id,
        exists: true,
      })
    }
  })
})

describe('runChecks', () => {
  const spec = (id: string, code: number, extra: Partial<CheckSpec> = {}): CheckSpec => ({
    id,
    guards: id,
    cmd: ['bun', '-e', `console.log('${id} says hi'); process.exit(${code})`],
    profiles: ['full'],
    ...extra,
  })

  test('runs everything, even after a failure, and reports each exit code', async () => {
    const results = await runChecks([spec('a', 1), spec('b', 0), spec('c', 3)], {
      root: '.',
      jobs: 2,
    })
    expect(results.map((r) => [r.id, r.code])).toEqual([
      ['a', 1],
      ['b', 0],
      ['c', 3],
    ])
    expect(results[0]?.output).toBe('a says hi')
    expect(formatTable(results)).toContain('2 of 3 FAILED')
  })

  test('a `first` check finishes before any other starts', async () => {
    const order: string[] = []
    await runChecks([spec('later', 0), spec('gen', 0, { first: true })], {
      root: '.',
      jobs: 4,
      onDone: (r) => order.push(r.id),
    })
    expect(order).toEqual(['gen', 'later'])
  })

  test('a command that cannot be spawned fails its check without losing the others', async () => {
    const results = await runChecks(
      [spec('missing', 0, { cmd: ['no-such-binary-su-srd'] }), spec('ok', 0)],
      { root: '.', jobs: 2 }
    )
    expect(results.map((r) => [r.id, r.code])).toEqual([
      ['missing', 127],
      ['ok', 0],
    ])
    expect(results[0]?.output).toContain('could not spawn')
  })
})
