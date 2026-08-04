/**
 * CLASS KIND STAMP + HYBRID REQUIREMENTS.
 *
 * A pilot class card names WHICH KIND of class it is in the seam — `[Class |
 * BASE / HYBRID / NON-ADVANCEABLE]` — and a hybrid additionally names the two
 * ability trees it advances from in the sub-header row, joined by "or".
 *
 * The kind is DERIVED from the two flags already stored in `classes.json`
 * (`hybrid`, `advanceable`), never from a third stored field. These tests drive
 * every assertion from the real ORM fixtures — all eleven classes by name — so
 * a data change that breaks the derivation fails here rather than silently
 * mis-stamping a card.
 */
import { beforeAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import {
  formatClassRequirements,
  isClassEntity,
  resolveAxisMarkers,
  resolveClassKind,
  resolveClassRequirements,
} from '../entityCardTone'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const classByName = (name: string) => {
  const found = SalvageUnionReference.Classes.all().find((c) => c.name === name)
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
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  test('the fixture set is exactly the eleven classes these tests enumerate', () => {
    const actual = SalvageUnionReference.Classes.all()
      .map((c) => String(c.name))
      .sort()
    expect(actual).toEqual(EXPECTED_KINDS.map(([name]) => name).sort())
  })

  test.each(EXPECTED_KINDS)('%s derives kind %s', (name, kind) => {
    expect(resolveClassKind(classByName(name))).toBe(kind)
  })

  test('every class is recognised by data shape, and non-classes are not', () => {
    for (const cls of SalvageUnionReference.Classes.all()) {
      expect(isClassEntity(cls)).toBe(true)
    }
    const firstOf = <T,>(list: T[], label: string): T => {
      const found = list[0]
      if (!found) throw new Error(`no ${label} fixtures loaded`)
      return found
    }
    expect(isClassEntity(firstOf(SalvageUnionReference.Chassis.all(), 'chassis'))).toBe(false)
    expect(isClassEntity(firstOf(SalvageUnionReference.Abilities.all(), 'ability'))).toBe(false)
  })

  test('the Salvager is the ONLY non-advanceable class', () => {
    const nonAdvanceable = SalvageUnionReference.Classes.all()
      .filter((c) => resolveClassKind(c) === 'NON-ADVANCEABLE')
      .map((c) => String(c.name))
    expect(nonAdvanceable).toEqual(['Salvager'])
  })

  test('no hybrid is mis-derived as non-advanceable (the `=== false` trap)', () => {
    // `advanceable` is *undefined* on hybrids, so a falsiness test rather than an
    // `=== false` test would stamp all five of them NON-ADVANCEABLE.
    for (const [name] of EXPECTED_REQUIREMENTS) {
      const cls = classByName(name)
      expect('advanceable' in cls ? cls.advanceable : undefined).toBeUndefined()
      expect(resolveClassKind(cls)).toBe('HYBRID')
    }
  })

  test('the kind rides the seam as a [Class | KIND] axis marker', () => {
    expect(resolveAxisMarkers(classByName('Ranger'))).toEqual([{ label: 'Class', value: 'HYBRID' }])
    expect(resolveAxisMarkers(classByName('Salvager'))).toEqual([
      { label: 'Class', value: 'NON-ADVANCEABLE' },
    ])
    expect(resolveAxisMarkers(classByName('Soldier'))).toEqual([{ label: 'Class', value: 'BASE' }])
  })
})

describe('hybrid class requirements', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  test.each(EXPECTED_REQUIREMENTS)('%s requires the trees %o', (name, trees) => {
    expect(resolveClassRequirements(classByName(name))).toEqual([...trees])
  })

  test('base and non-advanceable classes have no requirements', () => {
    for (const [name, kind] of EXPECTED_KINDS) {
      if (kind === 'HYBRID') continue
      expect(resolveClassRequirements(classByName(name))).toEqual([])
    }
  })

  test('the two trees are joined by "or" — never a comma list, never "and"', () => {
    const text = formatClassRequirements(resolveClassRequirements(classByName('Fabricator')))
    expect(text).toBe('Forging or Electronics')
    expect(text).not.toContain(',')
    expect(text).not.toContain(' and ')
  })

  test('an empty requirement list formats to nothing at all', () => {
    expect(formatClassRequirements([])).toBeUndefined()
  })
})

describe('class card rendering', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  test('a hybrid renders its two requirement trees, joined by "or"', () => {
    render(<ReferenceEntityCard data={classByName('Cyborg')} />)
    expect(
      screen.getByText(/Requires Augmentation or Gladiatorial Combat/i, { exact: false })
    ).toBeTruthy()
  })

  test('a base class renders no requirements at all', () => {
    render(<ReferenceEntityCard data={classByName('Soldier')} />)
    expect(screen.queryByText(/Requires/i)).toBeNull()
  })

  test('the Salvager stamps NON-ADVANCEABLE and asks for no trees', () => {
    render(<ReferenceEntityCard data={classByName('Salvager')} />)
    expect(screen.getByText('NON-ADVANCEABLE')).toBeTruthy()
    expect(screen.queryByText(/Requires/i)).toBeNull()
  })

  test('the kind stamp survives extent="catalog" — the deliberate exception', () => {
    // Catalog tiles suppress card chrome, but the class kind is exempt: a reader
    // scanning the class index needs to know a hybrid is unavailable at creation
    // before opening anything.
    render(<ReferenceEntityCard data={classByName('Smuggler')} extent="catalog" />)
    expect(screen.getByText('HYBRID')).toBeTruthy()
  })
})
