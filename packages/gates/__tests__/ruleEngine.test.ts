import { afterAll, describe, expect, test } from 'bun:test'
import { rmSync } from 'node:fs'
import type { Finding, RuleSet } from '../lib/ruleEngine'
import { evaluate, formatFailures, isExempt } from '../lib/ruleEngine'

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
    { id: 'r', rule: 'second law', fix: 'fix r', mode: 'zero' },
  ],
  scan: () => ({}),
}

describe('formatFailures', () => {
  test('a passing set prints nothing', () => {
    expect(formatFailures(evaluate(SET, { z: [], r: [] }))).toEqual([])
  })

  test('a rule cites its law, its fix and each finding, then points at the exemptions', () => {
    const text = formatFailures(evaluate(SET, { z: findings(2), r: [] })).join('\n')
    expect(text).toContain('── demo/z — zero law')
    expect(text).toContain('must be zero, found 2')
    expect(text).toContain('fix: fix z')
    expect(text).toContain('src/f0.ts:1  hit 0')
    expect(text).toContain('src/f1.ts:2  hit 1')
    expect(text).toContain('needs an EXEMPTIONS entry in packages/gates/rules/demo.ts')
  })

  test('more than 25 findings are capped with a count of the rest', () => {
    const lines = formatFailures(evaluate(SET, { z: findings(30), r: [] }))
    expect(lines.filter((l) => /^ {3}src\/f\d+\.ts:/.test(l))).toHaveLength(25)
    expect(lines).toContain('   … and 5 more')
    expect(lines.join('\n')).not.toContain('src/f25.ts')
  })
})

describe('isExempt', () => {
  const EX = [{ file: 'theme.css', rules: ['raw-color'], reason: 'the token source' }]

  test('a path fragment waives only the rules it names', () => {
    expect(isExempt(EX, 'apps/web/src/styles/theme.css', 'raw-color')).toBe(true)
    expect(isExempt(EX, 'apps/web/src/styles/theme.css', 'type-floor')).toBe(false)
    expect(isExempt(EX, 'apps/web/src/styles/index.css', 'raw-color')).toBe(false)
  })
})
