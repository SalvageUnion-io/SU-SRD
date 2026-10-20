/**
 * A Mini's chip budget (`chips-and-actions.md`, C3 and C4): rank, one lane
 * the container's context names, cost. Pinned per context, on synthetic models
 * and on real records through `toEntityModel`.
 */
import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from '../../index'
import type { ChipContext, MiniChipSource } from '../parts/tokenChips'
import { budgetFacts, laneMeasure, naturalContext, tokenChips } from '../parts/tokenChips'
import { toEntityModel } from '../toEntityModel'
import type { Fact } from '../types'

const fact = (key: string, short: string, value: string): Fact => ({
  key,
  label: short,
  short,
  value,
})

const TL = fact('tech-level', 'TL', '1')

const SYSTEM_REF = { schemaName: 'actions', id: 'a', slug: 'a', name: 'A' } as const

const SYSTEM: MiniChipSource = {
  facts: [TL, fact('ref-stat-slots', 'Slots', '3'), fact('ref-stat-range', 'RNG', 'C')],
  actionType: 'Turn',
  actions: [],
}

const CONTEXTS: readonly ChipContext[] = ['loadout', 'play', 'inventory', 'roster', 'browse']

describe('tokenChips', () => {
  test('every context keeps the rank and the cost, and adds at most one lane', () => {
    for (const context of CONTEXTS) {
      const chips = tokenChips({ ...SYSTEM, cost: '2 EP' }, context, { count: 3 })
      expect(chips.rank).toEqual({ label: 'TL', value: '1' })
      expect(chips.cost).toBe('2 EP')
      expect(Object.keys(chips).filter((key) => key === 'lane').length).toBeLessThanOrEqual(1)
    }
  })

  test('loadout names what it takes: Slots, else SP, else HP', () => {
    expect(tokenChips(SYSTEM, 'loadout').lane).toEqual({
      kind: 'cell',
      cell: { label: 'Slots', value: '3' },
    })
    const unit: MiniChipSource = { facts: [fact('SP', 'SP', '7/9')] }
    expect(tokenChips(unit, 'loadout').lane).toEqual({
      kind: 'cell',
      cell: { label: 'SP', value: '7/9' },
    })
  })

  test('play names the action type, or the count of two or more actions', () => {
    expect(tokenChips(SYSTEM, 'play').lane).toEqual({ kind: 'actionType', actionType: 'Turn' })
    const many = { ...SYSTEM, actions: [SYSTEM_REF, SYSTEM_REF, SYSTEM_REF] }
    expect(tokenChips(many, 'play').lane).toEqual({
      kind: 'cell',
      cell: { label: 'Actions', value: '3' },
    })
    const folded = { ...SYSTEM, actions: [SYSTEM_REF], folded: SYSTEM_REF }
    expect(tokenChips(folded, 'play').lane).toEqual({
      kind: 'cell',
      cell: { label: 'Actions', value: '1' },
    })
  })

  test('inventory names a quantity only above one', () => {
    expect(tokenChips(SYSTEM, 'inventory', { count: 1 }).lane).toBeUndefined()
    expect(tokenChips(SYSTEM, 'inventory', { count: 4 }).lane).toEqual({
      kind: 'cell',
      cell: { label: '×', value: '4' },
    })
  })

  test('roster names the lead vital as its live reading', () => {
    const pilot: MiniChipSource = { facts: [fact('HP', 'HP', '10/10')] }
    expect(tokenChips(pilot, 'roster').lane).toEqual({
      kind: 'cell',
      cell: { label: 'HP', value: '10/10' },
    })
  })

  test('browse carries no lane', () => {
    expect(tokenChips(SYSTEM, 'browse').lane).toBeUndefined()
  })

  test('the range, damage and traits never reach a Mini', () => {
    for (const context of CONTEXTS) {
      const chips = tokenChips(SYSTEM, context)
      expect(JSON.stringify(chips)).not.toContain('RNG')
    }
  })

  test('omit drops a fact the container states, the rank included', () => {
    const chips = tokenChips(SYSTEM, 'loadout', { omit: ['tech-level', 'ref-stat-slots'] })
    expect(chips.rank).toBeUndefined()
    expect(chips.lane).toBeUndefined()
  })

  test("a class's kind is its rank; an ability's tier never is", () => {
    const cls: MiniChipSource = {
      facts: [],
      kind: { stamp: 'Class', type: 'Class', domain: 'pilot', nature: 'have', classKind: 'BASE' },
    }
    expect(tokenChips(cls, 'browse').rank).toEqual({ label: 'BASE' })
    expect(tokenChips({ ...cls, tier: 'I' }, 'browse').rank).toBeUndefined()
  })

  test('a real system: Riveting Gun in a loadout and in play', () => {
    const gun = SalvageUnionReference.Systems.getByName('Riveting Gun')
    if (!gun) throw new Error('fixture missing: Riveting Gun')
    const model = toEntityModel(gun)
    const loadout = tokenChips(model, 'loadout')
    expect(loadout.rank?.label).toBe('TL')
    expect(loadout.lane).toEqual({ kind: 'cell', cell: { label: 'Slots', value: '3' } })
    expect(tokenChips(model, 'play').lane).toEqual({
      kind: 'cell',
      cell: { label: 'Actions', value: String(model.actions.length) },
    })
  })
})

describe('a contentful Mini (N3)', () => {
  const ACTION: MiniChipSource = {
    facts: [
      { ...fact('range', 'RNG', 'C'), group: 'action' },
      { ...fact('damage', 'DMG', '2'), group: 'action' },
    ],
    actionType: 'Turn',
    traits: [
      { name: 'Shield', schemaName: 'traits' },
      { name: 'Hot', param: '2', schemaName: 'traits' },
    ],
  }

  test('adds every action facet and the traits after the lane', () => {
    const chips = tokenChips(ACTION, 'play', { contentful: true })
    expect(chips.lane).toEqual({ kind: 'actionType', actionType: 'Turn' })
    expect(chips.facets).toEqual([
      { label: 'RNG', value: 'C' },
      { label: 'DMG', value: '2' },
    ])
    expect(chips.traits).toEqual([{ label: 'Shield' }, { label: 'Hot', value: '2' }])
  })

  test('a header-only Mini carries neither', () => {
    const chips = tokenChips(ACTION, 'play')
    expect(chips.facets).toBeUndefined()
    expect(chips.traits).toBeUndefined()
  })

  test("a unit's ungrouped readings never read as facets", () => {
    const lead: MiniChipSource = {
      facts: [{ ...fact('HP', 'HP', '4/6'), group: 'vitals' }, fact('x', 'TL', '2')],
    }
    expect(tokenChips(lead, 'roster', { contentful: true }).facets).toBeUndefined()
  })
})

describe('a compact Card or Compact head (C3)', () => {
  const stats: Fact[] = [
    { ...TL, group: 'provenance' },
    { ...fact('slots', 'Slots', '3'), group: 'provenance' },
    { ...fact('sv', 'SV', '2'), group: 'provenance' },
    { ...fact('range', 'RNG', 'C'), group: 'action' },
  ]

  test('keeps its Tech Level, the one measure its context names, and every action facet', () => {
    expect(budgetFacts(stats, 'loadout').map((f) => f.short)).toEqual(['TL', 'Slots', 'RNG'])
    expect(budgetFacts(stats, 'play').map((f) => f.short)).toEqual(['TL', 'RNG'])
  })

  test('the lane measure is the first its context weighs that the head has', () => {
    expect(laneMeasure('loadout', ['TL', 'SV', 'SP', 'EP'])).toBe('SP')
    expect(laneMeasure('roster', ['HP'])).toBe('HP')
    expect(laneMeasure('browse', ['Slots'])).toBeUndefined()
  })

  test("an unnamed context is the head's kind's own", () => {
    expect(naturalContext({ domain: 'gear', nature: 'have' })).toBe('loadout')
    expect(naturalContext({ domain: 'pilot', nature: 'do' })).toBe('play')
    expect(naturalContext({ domain: 'actor', nature: 'have' })).toBe('roster')
    expect(naturalContext({ domain: 'glossary', nature: 'have' })).toBe('browse')
  })

  test('a contentful head outside play adds its action type after the lane', () => {
    const chips = tokenChips(SYSTEM, 'loadout', { contentful: true })
    expect(chips.lane).toEqual({ kind: 'cell', cell: { label: 'Slots', value: '3' } })
    expect(chips.economy).toEqual({ kind: 'actionType', actionType: 'Turn' })
    expect(tokenChips(SYSTEM, 'play', { contentful: true }).economy).toBeUndefined()
  })
})
