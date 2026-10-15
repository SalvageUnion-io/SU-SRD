/**
 * CLASS KIND + HYBRID REQUIREMENTS, as the entity model derives them.
 *
 * The kind is DERIVED from the two flags already stored in `classes.json`
 * (`hybrid`, `advanceable`), never from a third stored field. Every assertion
 * runs on the real fixtures — all eleven classes by name — so a data change
 * that breaks the derivation fails here rather than silently mis-stamping a
 * card. How the card renders them is src/ui's `classKind.test.tsx`.
 */
import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from '../../index'
import { classKind, classRequirements, isClassEntity } from '../parts/kind'

const classByName = (name: string) => {
  const found = SalvageUnionReference.Classes.getByName(name)
  if (!found) throw new Error(`class fixture missing: ${name}`)
  return found
}

/** Every class in the dataset, with the kind its two stored flags imply. */
const EXPECTED_KINDS = [
  ['Engineer', 'BASE'],
  ['Hacker', 'BASE'],
  ['Hauler', 'BASE'],
  ['Scout', 'BASE'],
  ['Soldier', 'BASE'],
  ['Salvager', 'NON-ADVANCEABLE'],
  ['Fabricator', 'HYBRID'],
  ['Cyborg', 'HYBRID'],
  ['Union Rep', 'HYBRID'],
  ['Smuggler', 'HYBRID'],
  ['Ranger', 'HYBRID'],
] as const

/** The two parent trees each hybrid advances from, per ability-tree-requirements. */
const EXPECTED_REQUIREMENTS = [
  ['Fabricator', ['Forging', 'Electronics']],
  ['Cyborg', ['Augmentation', 'Gladiatorial Combat']],
  ['Union Rep', ['Leadership', 'Mechanical Knowledge']],
  ['Smuggler', ['Sleuth', 'Salvaging']],
  ['Ranger', ['Survivalist', 'Sniper']],
] as const

describe('class kind derivation', () => {
  test('the fixture set is exactly the eleven classes these tests enumerate', () => {
    const actual = SalvageUnionReference.Classes.all()
      .map((c) => String(c.name))
      .sort()
    expect(actual).toEqual(EXPECTED_KINDS.map(([name]) => name).sort())
  })

  test.each(EXPECTED_KINDS)('%s derives kind %s', (name, kind) => {
    expect(classKind(classByName(name))).toBe(kind)
  })

  test('every class is recognised by data shape, and non-classes are not', () => {
    for (const cls of SalvageUnionReference.Classes.all()) {
      expect(isClassEntity(cls)).toBe(true)
    }
    const firstOf = <T>(list: T[], label: string): T => {
      const found = list[0]
      if (!found) throw new Error(`no ${label} fixtures loaded`)
      return found
    }
    expect(isClassEntity(firstOf(SalvageUnionReference.Chassis.all(), 'chassis'))).toBe(false)
    expect(isClassEntity(firstOf(SalvageUnionReference.Abilities.all(), 'ability'))).toBe(false)
  })

  test('the Salvager is the ONLY non-advanceable class', () => {
    const nonAdvanceable = SalvageUnionReference.Classes.all()
      .filter((c) => classKind(c) === 'NON-ADVANCEABLE')
      .map((c) => String(c.name))
    expect(nonAdvanceable).toEqual(['Salvager'])
  })

  test('no hybrid is mis-derived as non-advanceable (the ordering trap)', () => {
    // Hybrids now carry `advanceable: false` explicitly — a hybrid HAS advanced
    // and "cannot advance into any other Hybrid Class or Advanced Tree" (p.321).
    //
    // That makes `resolveClassKind`'s ORDER load-bearing rather than incidental.
    // While `advanceable` was undefined here, the `=== false` branch could never
    // catch a hybrid whatever the order. Now it would: check `advanceable`
    // before `hybrid` and all five stamp NON-ADVANCEABLE. This test is the
    // tripwire for that reordering.
    for (const [name] of EXPECTED_REQUIREMENTS) {
      const cls = classByName(name)
      expect('advanceable' in cls ? cls.advanceable : undefined).toBe(false)
      expect(classKind(cls)).toBe('HYBRID')
    }
  })
})

describe('hybrid class requirements', () => {
  test.each(EXPECTED_REQUIREMENTS)('%s requires the trees %o', (name, trees) => {
    expect(classRequirements(classByName(name))).toEqual([...trees])
  })

  test('base and non-advanceable classes have no requirements', () => {
    for (const [name, kind] of EXPECTED_KINDS) {
      if (kind === 'HYBRID') continue
      expect(classRequirements(classByName(name))).toEqual([])
    }
  })
})
