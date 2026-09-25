import { describe, expect, test } from 'bun:test'
import { checkSource } from '../check-architecture'

/**
 * `tools/check-architecture.ts` gates merges on three AST rules. These run the
 * rules against fixture source, since the real tree is clean — which is exactly
 * when a rule that stopped matching would go unnoticed.
 */

const rules = (relPath: string, text: string) => checkSource(relPath, text).map((v) => v.rule)

describe('module-scope-orm', () => {
  test('an accessor call at module scope is a violation', () => {
    const text = 'const all = SalvageUnionReference.Chassis.all()\nexport { all }\n'
    expect(rules('apps/srd/src/a.ts', text)).toEqual(['module-scope-orm'])
  })

  test('the same call inside a function is fine', () => {
    const text = 'export function f() {\n  return SalvageUnionReference.Chassis.all()\n}\n'
    expect(rules('apps/srd/src/a.ts', text)).toEqual([])
  })

  test('preload() and isLoaded() are lifecycle calls, exempt at module scope', () => {
    const text = "SalvageUnionReference.preload('all')\nSalvageUnionReference.isLoaded()\n"
    expect(rules('apps/srd/src/a.ts', text)).toEqual([])
  })

  test('a direct accessor like SalvageUnionReference.search() is caught too', () => {
    expect(rules('apps/srd/src/a.ts', "const r = SalvageUnionReference.search('x')\n")).toEqual([
      'module-scope-orm',
    ])
  })
})

describe('inline-pool-default', () => {
  test('`entity.currentX ?? max` inlines the pool rule', () => {
    const text =
      'export const hp = (p: { currentDamage?: number }, max: number) => p.currentDamage ?? max\n'
    expect(rules('apps/itun/src/a.ts', text)).toEqual(['inline-pool-default'])
  })

  test('a string fallback is a label, not a pool default', () => {
    const text = "export const s = (p: { currentName?: string }) => p.currentName ?? 'none'\n"
    expect(rules('apps/itun/src/a.ts', text)).toEqual([])
  })
})

describe('oversized-function', () => {
  const body = (lines: number) => `export function big() {\n${'  f()\n'.repeat(lines)}}\n`

  test('applies only inside component-lib', () => {
    expect(rules('apps/itun/src/a.ts', body(1900))).toEqual([])
    expect(rules('packages/component-lib/src/a.ts', body(1900))).toEqual(['oversized-function'])
  })

  test('a body under the cap passes', () => {
    expect(rules('packages/component-lib/src/a.ts', body(50))).toEqual([])
  })
})
