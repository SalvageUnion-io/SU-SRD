import { describe, test, expect } from 'bun:test'
import { filterActions } from '../useActionFilters'
import type { ActionTypeFilter, CategoryFilter } from '../useActionFilters'
import type { ActionDisplayData, ActionSource } from '../../lib/pilotActionUtils'

function makeAction(overrides: {
  actionType?: string
  source?: ActionSource
  hasDamage?: boolean
  name?: string
}): ActionDisplayData {
  return {
    key: overrides.name ?? 'test',
    name: overrides.name ?? 'Test Action',
    actionName: overrides.name ?? 'test',
    sourceEntity: {} as never,
    sourceSchemaName: 'abilities' as never,
    borderColor: '#000',
    dataValues: [],
    entityRefId: null,
    activationCost: null,
    maxUses: null,
    usesRemaining: null,
    requiredTraits: [],
    actionType: overrides.actionType ?? 'Turn',
    source: overrides.source ?? 'pilot',
    costType: 'none',
    hasDamage: overrides.hasDamage ?? false,
    isComrade: false,
    condition: 'intact' as const,
  }
}

describe('filterActions', () => {
  const actions = [
    makeAction({ name: 'pilot-turn', actionType: 'Turn', source: 'pilot', hasDamage: false }),
    makeAction({ name: 'pilot-free', actionType: 'Free', source: 'pilot', hasDamage: false }),
    makeAction({ name: 'pilot-attack', actionType: 'Turn', source: 'pilot', hasDamage: true }),
    makeAction({ name: 'pilot-passive', actionType: 'Passive', source: 'pilot', hasDamage: false }),
    makeAction({ name: 'mech-reaction', actionType: 'Reaction', source: 'mech', hasDamage: true }),
    makeAction({ name: 'mech-turn', actionType: 'Turn', source: 'mech', hasDamage: false }),
    makeAction({ name: 'general-free', actionType: 'Free', source: 'general', hasDamage: false }),
    makeAction({ name: 'general-long', actionType: 'Long', source: 'general', hasDamage: false }),
  ]

  test('empty filters return all actions', () => {
    const result = filterActions(actions, new Set(), new Set())
    expect(result).toHaveLength(8)
  })

  // --- Type filtering ---

  test('type filter: single type', () => {
    const types = new Set<ActionTypeFilter>(['Free'])
    const result = filterActions(actions, types, new Set())
    expect(result.map((a) => a.name)).toEqual(['pilot-free', 'general-free'])
  })

  test('type filter: multiple types (OR within row)', () => {
    const types = new Set<ActionTypeFilter>(['Turn', 'Reaction'])
    const result = filterActions(actions, types, new Set())
    expect(result.map((a) => a.name)).toEqual([
      'pilot-turn',
      'pilot-attack',
      'mech-reaction',
      'mech-turn',
    ])
  })

  test('type filter: Passive', () => {
    const types = new Set<ActionTypeFilter>(['Passive'])
    const result = filterActions(actions, types, new Set())
    expect(result.map((a) => a.name)).toEqual(['pilot-passive'])
  })

  test('type filter: no matching type returns empty', () => {
    const types = new Set<ActionTypeFilter>(['DownTime'])
    const result = filterActions(actions, types, new Set())
    expect(result).toHaveLength(0)
  })

  // --- Type filter: Attacks (damage-based) ---

  test('type filter: Attacks matches actions with damage', () => {
    const types = new Set<ActionTypeFilter>(['Attacks'])
    const result = filterActions(actions, types, new Set())
    expect(result.map((a) => a.name)).toEqual(['pilot-attack', 'mech-reaction'])
  })

  test('type filter: Attacks matches damage-only actions (no actionType)', () => {
    const withWeapon = [
      ...actions,
      makeAction({ name: 'weapon-stat', actionType: '', source: 'mech', hasDamage: true }),
    ]
    const types = new Set<ActionTypeFilter>(['Attacks'])
    const result = filterActions(withWeapon, types, new Set())
    expect(result.map((a) => a.name)).toEqual(['pilot-attack', 'mech-reaction', 'weapon-stat'])
  })

  test('damage-only actions (no actionType) do not match named type filters', () => {
    const withWeapon = [
      makeAction({ name: 'weapon-stat', actionType: '', source: 'mech', hasDamage: true }),
    ]
    const types = new Set<ActionTypeFilter>(['Turn'])
    const result = filterActions(withWeapon, types, new Set())
    expect(result).toHaveLength(0)
  })

  test('type filter: Turn + Attacks (OR within row)', () => {
    const types = new Set<ActionTypeFilter>(['Turn', 'Attacks'])
    const result = filterActions(actions, types, new Set())
    expect(result.map((a) => a.name)).toEqual([
      'pilot-turn',
      'pilot-attack',
      'mech-reaction',
      'mech-turn',
    ])
  })

  // --- Category filtering ---

  test('category filter: Pilot', () => {
    const cats = new Set<CategoryFilter>(['Pilot'])
    const result = filterActions(actions, new Set(), cats)
    expect(result.map((a) => a.name)).toEqual([
      'pilot-turn',
      'pilot-free',
      'pilot-attack',
      'pilot-passive',
    ])
  })

  test('category filter: Mech', () => {
    const cats = new Set<CategoryFilter>(['Mech'])
    const result = filterActions(actions, new Set(), cats)
    expect(result.map((a) => a.name)).toEqual(['mech-reaction', 'mech-turn'])
  })

  test('category filter: Generic', () => {
    const cats = new Set<CategoryFilter>(['Generic'])
    const result = filterActions(actions, new Set(), cats)
    expect(result.map((a) => a.name)).toEqual(['general-free', 'general-long'])
  })

  test('category filter: Pilot + Mech (OR within row)', () => {
    const cats = new Set<CategoryFilter>(['Pilot', 'Mech'])
    const result = filterActions(actions, new Set(), cats)
    expect(result.map((a) => a.name)).toEqual([
      'pilot-turn',
      'pilot-free',
      'pilot-attack',
      'pilot-passive',
      'mech-reaction',
      'mech-turn',
    ])
  })

  // --- Combined (AND between rows) ---

  test('type + category: AND between rows', () => {
    const types = new Set<ActionTypeFilter>(['Free'])
    const cats = new Set<CategoryFilter>(['Generic'])
    const result = filterActions(actions, types, cats)
    // Only general-free is both Free AND Generic
    expect(result.map((a) => a.name)).toEqual(['general-free'])
  })

  test('type + category: Mech + Turn', () => {
    const types = new Set<ActionTypeFilter>(['Turn'])
    const cats = new Set<CategoryFilter>(['Mech'])
    const result = filterActions(actions, types, cats)
    expect(result.map((a) => a.name)).toEqual(['mech-turn'])
  })

  test('type + category: Attacks type + Generic source (AND between rows)', () => {
    const types = new Set<ActionTypeFilter>(['Attacks'])
    const cats = new Set<CategoryFilter>(['Generic'])
    const result = filterActions(actions, types, cats)
    // No generic actions have damage, so empty
    expect(result).toHaveLength(0)
  })
})
