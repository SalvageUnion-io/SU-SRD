import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { proseHash, readLockFile } from 'gates/lib/proseFidelity'
import { main, ratchetProblems } from '../check-fidelity-lock'

const AT = { deviation: 2, unverified: 3, 'unverified-source': 4 }

describe('check-fidelity-lock — the drift ratchet', () => {
  test('counts at their baseline pass', () => {
    expect(ratchetProblems(AT, AT)).toEqual([])
  })

  test('a new deviation fails, pointing at the book or a stated rise', () => {
    const [problem, ...rest] = ratchetProblems(AT, { ...AT, deviation: 3 })
    expect(rest).toEqual([])
    expect(problem).toContain('3 `deviation` verdicts, baseline 2')
    expect(problem).toContain('--allow-increase')
  })

  test('a fall must be recorded, and a missing baseline allows none', () => {
    expect(ratchetProblems(AT, { ...AT, unverified: 1 })[0]).toContain('lock the gain in')
    expect(ratchetProblems({}, AT)).toHaveLength(3)
  })
})

describe('check-fidelity-lock — main', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fidelity-lock-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))
  // The real lock's generated header, which a fixture lock must carry to parse.
  const { $comment, editions } = (readLockFile() ?? {}) as { $comment?: string; editions?: object }
  const ITEMS = [
    { key: 'a', text: 'Verbatim words.' },
    { key: 'b', text: 'Paraphrased words.' },
  ]
  const collect = () => ({ prose: ITEMS, stats: [] })
  let n = 0
  /** A lock and a baseline in `dir`, then `main` over them with its output captured. */
  const run = (
    argv: string[],
    entries: Record<string, string>,
    baseline: object | null = { deviation: 1, unverified: 0, 'unverified-source': 0 }
  ) => {
    n++
    const lockPath = join(dir, `lock-${n}.json`)
    const baselinePath = join(dir, `baseline-${n}.json`)
    writeFileSync(lockPath, JSON.stringify({ $comment, editions, entries }))
    if (baseline) writeFileSync(baselinePath, JSON.stringify(baseline))
    const out: string[] = []
    const err: string[] = []
    const code = main(argv, {
      collect,
      lockPath,
      baselinePath,
      log: (l) => out.push(l),
      error: (l) => err.push(l),
    })
    return { code, out, err, lockPath, baselinePath }
  }
  const LOCKED = {
    a: `${proseHash('Verbatim words.')} 0123456789ab verbatim`,
    b: `${proseHash('Paraphrased words.')} 0123456789ab deviation paraphrase`,
  }

  test('the real repository passes', () => {
    expect(main([], { log: () => {}, error: () => {} })).toBe(0)
  })

  test('a lock at its baseline passes and reports the counts', () => {
    const r = run([], LOCKED)
    expect(r.code).toBe(0)
    expect(r.out[0]).toContain('2 prose strings, 0 stat blocks; lock: 1 verbatim, 1 deviation')
  })

  test('a missing lock fails', () => {
    const out: string[] = []
    const code = main([], {
      collect,
      lockPath: join(dir, 'none.json'),
      error: (l) => out.push(l),
      log: () => {},
    })
    expect(code).toBe(1)
    expect(out[0]).toContain('is missing or not JSON')
  })

  test('a new, edited, stale or malformed entry fails, and so does a new deviation', () => {
    const r = run(
      [],
      { a: '0000000000000000 0123456789ab verbatim', gone: LOCKED.a, bad: 'nonsense' },
      {}
    )
    expect(r.code).toBe(1)
    const text = r.err.join('\n')
    expect(text).toContain('malformed lock entr')
    expect(text).toContain('a (edited)')
    expect(text).toContain('b (new)')
    expect(text).toContain('for strings that no longer exist')
    const drift = run([], LOCKED, { deviation: 0 })
    expect(drift.err.join('\n')).toContain('drift verdicts off their baseline')
  })

  test('more than 20 unverified strings are capped with a count', () => {
    const many = Array.from({ length: 22 }, (_, i) => ({ key: `k${i}`, text: `t${i}` }))
    const out: string[] = []
    const lockPath = join(dir, 'empty.json')
    writeFileSync(lockPath, JSON.stringify({ $comment, editions, entries: {} }))
    main([], {
      collect: () => ({ prose: many, stats: [] }),
      lockPath,
      baselinePath: join(dir, 'none.json'),
      log: () => {},
      error: (l) => out.push(l),
    })
    expect(out).toContain('  … and 2 more')
  })

  test('--prune drops entries for strings that are gone', () => {
    const r = run(['--prune'], { ...LOCKED, gone: LOCKED.a })
    expect(r.code).toBe(0)
    expect(r.out).toEqual(['Dropped 1 stale entry.'])
    expect(Object.keys(readLockFile(r.lockPath)?.entries ?? {})).toEqual(['a', 'b'])
  })

  test('--update-baseline lowers, and raises only with --allow-increase', () => {
    const lower = run(['--update-baseline'], LOCKED, { deviation: 2 })
    expect(lower.code).toBe(0)
    expect(JSON.parse(readFileSync(lower.baselinePath, 'utf8'))).toEqual({
      deviation: 1,
      unverified: 0,
      'unverified-source': 0,
    })
    const raise = run(['--update-baseline'], LOCKED, null)
    expect(raise.code).toBe(1)
    expect(raise.err[0]).toContain('refusing to RAISE deviation')
    expect(run(['--update-baseline', '--allow-increase'], LOCKED, null).code).toBe(0)
  })
})
