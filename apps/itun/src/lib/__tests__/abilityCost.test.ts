/**
 * Tests for resolveAbilityApCost (Slice D).
 *
 * Resolves the fixed AP cost of a pilot ability from its referenced actions.
 * Uses real salvageunion-reference data so the resolution path (ability →
 * actions → activationCost) is exercised end-to-end.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefAbility } from 'salvageunion-reference'

import { resolveAbilityApCost } from '../abilityCost'

beforeAll(async () => {
  // resolveAbilityApCost reads Abilities + Actions models; preload them so the
  // lazy-loaded reference schemas are available in the test runtime.
  await SalvageUnionReference.preload(['abilities', 'actions'])
})

function findAbility(name: string): SURefAbility {
  const all = SalvageUnionReference.Abilities.all() as ReadonlyArray<SURefAbility>
  const ability = all.find((a) => a.name === name)
  if (!ability) throw new Error(`Ability "${name}" not found in reference data`)
  return ability
}

describe('resolveAbilityApCost', () => {
  test('resolves a fixed numeric AP cost from the ability action', () => {
    // "Talk Shop" → action "Talk Shop" with activationCost 3
    expect(resolveAbilityApCost(findAbility('Talk Shop'))).toBe(3)
  })

  test('resolves a different fixed AP cost', () => {
    // "Mech Acquisition" → activationCost 2
    expect(resolveAbilityApCost(findAbility('Mech Acquisition'))).toBe(2)
  })

  test('returns null for a variable (X) cost ability', () => {
    // "Mass Field Maintenance" → action activationCost 'X' (variable)
    expect(resolveAbilityApCost(findAbility('Mass Field Maintenance'))).toBeNull()
  })

  test('returns null when the ability has no resolvable actions', () => {
    const bogus: SURefAbility = {
      id: 'bogus',
      name: 'Nonexistent Ability',
      source: 'Salvage Union Workshop Manual',
      page: 1,
      indexable: true,
      blackMarket: false,
      tree: 'Mechanical Knowledge',
      level: 1,
      actions: [],
    }
    expect(resolveAbilityApCost(bogus)).toBeNull()
  })
})
