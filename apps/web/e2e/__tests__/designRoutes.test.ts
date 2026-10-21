/**
 * Hard rule R0, "Every layout gate sees every context": `designRoutes`
 * (`_designTable.ts`) has an entry for every route family, at every width the
 * family is held to, and every path it names the seed makes. A new family in
 * `DESIGN_FAMILIES` with no entry fails here, before a browser runs.
 */
import { describe, expect, test } from 'bun:test'
import type {
  DesignContext,
  DesignDebt,
  DesignFamily,
  DesignFinding,
  DesignWidth,
} from '../_designTable'
import {
  againstBaseline,
  DESIGN_FAMILIES,
  DESIGN_SEED_KEYS,
  designRoutes,
  ONE_WIDTH,
} from '../_designTable'

const FAMILIES = Object.keys(DESIGN_FAMILIES) as DesignFamily[]
const WIDTHS: readonly DesignWidth[] = ['page', 'phone']

describe('designRoutes', () => {
  test.each(FAMILIES)('%s has an entry', (family) => {
    expect(designRoutes.filter((r) => r.family === family).length).toBeGreaterThan(0)
  })

  test.each(FAMILIES)('%s is held at every width it must be', (family) => {
    const held = new Set(designRoutes.filter((r) => r.family === family).flatMap((r) => r.widths))
    const only = ONE_WIDTH[family]
    expect([...held].sort()).toEqual(only ? [only.width] : [...WIDTHS].sort())
  })

  test('every context of ruleset §1 has a family', () => {
    const contexts: DesignContext[] = [
      'reference',
      'listing',
      'peek',
      'sheet',
      'wizard',
      'manage',
      'play',
    ]
    const seen = new Set(Object.values(DESIGN_FAMILIES))
    for (const context of contexts) expect(seen.has(context)).toBe(true)
  })

  test('every Live Sheet kind is seen in Read and in Edit', () => {
    for (const kind of ['pilot', 'mech', 'crawler', 'npc']) {
      const read = designRoutes.filter((r) => r.family === `sheet-${kind}-read`)
      const edit = designRoutes.filter((r) => r.family === `sheet-${kind}-edit`)
      expect(read.length).toBeGreaterThan(0)
      expect(read.every((r) => !r.edit)).toBe(true)
      expect(edit.length).toBeGreaterThan(0)
      expect(edit.every((r) => r.edit)).toBe(true)
    }
  })

  test('every seeded path is one the seed makes', () => {
    const keys = new Set<string>(DESIGN_SEED_KEYS)
    for (const route of designRoutes) {
      if (route.path.startsWith(':')) expect(keys.has(route.path.slice(1))).toBe(true)
      else expect(route.path.startsWith('/')).toBe(true)
    }
  })

  test('the Peek is the only entry that opens one', () => {
    expect(designRoutes.filter((r) => r.peek).map((r) => r.family)).toEqual(['peek'])
  })
})

describe('againstBaseline', () => {
  const finding = (family: DesignFamily, rule: string, line: string): DesignFinding => ({
    family,
    rule,
    line,
  })
  const debt = (family: DesignFamily, rule: string, match: string): DesignDebt => ({
    family,
    rule,
    match,
    why: 'a test',
  })

  test('a finding is held only by a debt on its family and rule whose match it contains', () => {
    const baseline = [debt('training-bay', 'sibling', 'button.su-btn "New Game"')]
    const findings = [
      finding(
        'training-bay',
        'sibling',
        'training-bay /build/ at phone, div.row: 44px button.su-btn "New Game"'
      ),
      finding('play-hub', 'sibling', 'play-hub at phone, div.row: 44px button.su-btn "New Game"'),
      finding('training-bay', 'gap', 'training-bay at phone, gap: button.su-btn "New Game"'),
    ]
    const { fresh, held, stale } = againstBaseline(findings, baseline)
    expect(held).toEqual([findings[0] as DesignFinding])
    expect(fresh).toEqual([findings[1] as DesignFinding, findings[2] as DesignFinding])
    expect(stale).toEqual([])
  })

  test('a debt nothing matched is stale', () => {
    const baseline = [debt('invite', 'N1', 'Invite (TitledBox)')]
    expect(againstBaseline([], baseline).stale).toEqual(baseline)
  })
})
