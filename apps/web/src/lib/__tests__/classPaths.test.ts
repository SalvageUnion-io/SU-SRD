import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import { must } from '../../components/__tests__/must'
import { resolveClassPlan } from '../classPaths'

const classNamed = (name: string) => must(SalvageUnionReference.Classes.getByName(name))

describe('resolveClassPlan', () => {
  test('a Core class advances into its own tree first, then the hybrids its own trees open', () => {
    const plan = resolveClassPlan(classNamed('Engineer'))
    if (plan.kind !== 'core') throw new Error(`expected a core plan, got ${plan.kind}`)
    expect(plan.coreTrees.map((g) => g.tree)).toEqual([
      'Mechanical Knowledge',
      'Forging',
      'Mech-Tech',
    ])
    expect(
      plan.paths.map((p) => [p.hybrid?.name, p.via, p.advanced.tree, p.legendary?.tree])
    ).toEqual([
      [undefined, undefined, 'Advanced Engineer', 'Legendary Engineer'],
      ['Fabricator', 'Forging', 'Fabricator', 'Legendary Fabricator'],
      ['Union Rep', 'Mechanical Knowledge', 'Union Rep', 'Legendary Union Rep'],
    ])
    expect(plan.paths[0]?.requirement).toEqual(['Mech-Tech'])
  })

  test('every advancing Core class reaches two Hybrid Classes (Workshop Manual spreads)', () => {
    const core = SalvageUnionReference.Classes.all().filter(
      (c) => c.hybrid === false && c.advanceable
    )
    expect(core).toHaveLength(5)
    for (const c of core) {
      const plan = resolveClassPlan(c)
      if (plan.kind !== 'core') throw new Error(`${c.name}: expected a core plan`)
      expect(plan.paths.filter((p) => p.hybrid)).toHaveLength(2)
      expect(plan.paths[0]?.hybrid).toBeUndefined()
    }
  })

  test('the Salvager trains every Core tree and advances into nothing', () => {
    const plan = resolveClassPlan(classNamed('Salvager'))
    if (plan.kind !== 'core') throw new Error(`expected a core plan, got ${plan.kind}`)
    expect(plan.coreTrees).toHaveLength(15)
    expect(plan.paths).toEqual([])
  })

  test('a Hybrid Class carries its own trees and branches into the Core trees it requires', () => {
    const plan = resolveClassPlan(classNamed('Fabricator'))
    if (plan.kind !== 'hybrid') throw new Error(`expected a hybrid plan, got ${plan.kind}`)
    expect(plan.path.advanced.abilities.map((a) => a.level)).toEqual([1, 2, 3])
    expect(plan.path.legendary?.abilities).toHaveLength(2)
    expect(plan.branches.map((b) => [b.tree, b.owner?.name, b.group?.abilities.length])).toEqual([
      ['Forging', 'Engineer', 3],
      ['Electronics', 'Hacker', 3],
    ])
  })
})
