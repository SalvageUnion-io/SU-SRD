import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Finding, RuleSet } from '../lib/ruleEngine'
import { evaluate, formatFailures, isExempt, readBaseline } from '../lib/ruleEngine'

/**
 * The engine's verdicts are pinned in check-styling.test.ts; these pin what a
 * failing run PRINTS — the report is the only thing an author sees in CI.
 */

const temps: string[] = []
afterAll(() => {
  for (const t of temps) rmSync(t, { recursive: true, force: true })
})

const findings = (n: number): Finding[] =>
  Array.from({ length: n }, (_, i) => ({ file: `src/f${i}.ts`, line: i + 1, detail: `hit ${i}` }))

const SET: RuleSet = {
  id: 'demo',
  label: 'demo',
  exemptionsLive: 'packages/gates/rules/demo.ts',
  rules: [
    { id: 'z', rule: 'zero law', fix: 'fix z', mode: 'zero' },
    { id: 'r', rule: 'ratchet law', fix: 'fix r', mode: 'ratchet' },
  ],
  scan: () => ({}),
}

describe('readBaseline', () => {
  test('a missing baseline file is an empty baseline, not an error', () => {
    expect(readBaseline(join(tmpdir(), 'no-such-dir-for-gates', 'baseline.json'))).toEqual({})
  })

  test('reads the committed JSON keyed by rule set', () => {
    const dir = mkdtempSync(join(tmpdir(), 'baseline-'))
    temps.push(dir)
    const path = join(dir, 'baseline.json')
    writeFileSync(path, JSON.stringify({ demo: { r: 4 }, other: { x: 1 } }))
    expect(readBaseline(path)).toEqual({ demo: { r: 4 }, other: { x: 1 } })
  })
})

describe('formatFailures', () => {
  test('a passing set prints nothing', () => {
    expect(formatFailures(evaluate(SET, { z: [], r: findings(2) }, { r: 2 }), 'UPD')).toEqual([])
  })

  test('a zero rule cites its law, its fix and each finding, then points at the exemptions', () => {
    const text = formatFailures(evaluate(SET, { z: findings(2), r: [] }), 'UPD').join('\n')
    expect(text).toContain('── demo/z — zero law')
    expect(text).toContain('must be zero, found 2')
    expect(text).toContain('fix: fix z')
    expect(text).toContain('src/f0.ts:1  hit 0')
    expect(text).toContain('src/f1.ts:2  hit 1')
    expect(text).toContain('needs an EXEMPTIONS entry in packages/gates/rules/demo.ts')
    expect(text).toContain('not a higher number')
  })

  test('a regressed ratchet prints allowed, found and the overshoot', () => {
    const text = formatFailures(evaluate(SET, { z: [], r: findings(5) }, { r: 3 }), 'UPD').join(
      '\n'
    )
    expect(text).toContain('── demo/r — ratchet law')
    expect(text).toContain('3 allowed, 5 found (+2)')
    expect(text).toContain('fix: fix r')
  })

  test('more than 25 findings are capped with a count of the rest', () => {
    const lines = formatFailures(evaluate(SET, { z: findings(30), r: [] }), 'UPD')
    expect(lines.filter((l) => /^ {3}src\/f\d+\.ts:/.test(l))).toHaveLength(25)
    expect(lines).toContain('   … and 5 more')
    expect(lines.join('\n')).not.toContain('src/f25.ts')
  })

  test('an unrecorded improvement asks for a baseline update, not an exemption', () => {
    const text = formatFailures(evaluate(SET, { z: [], r: findings(1) }, { r: 3 }), 'UPD').join(
      '\n'
    )
    expect(text).toContain('improved: baseline says 3, found 1')
    expect(text).toContain('run: UPD')
    expect(text).not.toContain('EXEMPTIONS')
    expect(text).not.toContain('fix: fix r')
  })

  test('a stale baseline key is named with the update command', () => {
    const text = formatFailures(evaluate(SET, { z: [], r: [] }, { gone: 2 }), 'UPD').join('\n')
    expect(text).toContain('baseline names `gone`, which is not a ratchet rule of this set')
    expect(text).toContain('Zero rules carry no baseline. run: UPD')
    expect(text).not.toContain('EXEMPTIONS')
  })
})

describe('isExempt', () => {
  const EX = [{ file: 'theme.css', rules: ['raw-color'], reason: 'the token source' }]

  test('a path fragment waives only the rules it names', () => {
    expect(isExempt(EX, 'apps/web/src/ui/styles/theme.css', 'raw-color')).toBe(true)
    expect(isExempt(EX, 'apps/web/src/ui/styles/theme.css', 'type-floor')).toBe(false)
    expect(isExempt(EX, 'apps/web/src/ui/styles/index.css', 'raw-color')).toBe(false)
  })
})
