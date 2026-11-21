/** An ability's Training Point cost by its tier (Core Book p.224; SB-04). */

import { describe, expect, test } from 'bun:test'
import { nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { abilityTrainingCost } from '../training'

describe('abilityTrainingCost', () => {
  test('a Core ability costs 1', () => {
    expect(abilityTrainingCost('engineering-expertise')).toBe(1)
  })

  test('a Legendary ability costs 3', () => {
    const legendary = SalvageUnionReference.Abilities.all().find((a) => a.level === 'L')
    expect(legendary && abilityTrainingCost(nameToSlug(legendary.name))).toBe(3)
  })

  test('an ability the data does not hold has no price', () => {
    expect(abilityTrainingCost('no-such-ability')).toBeNull()
  })
})
