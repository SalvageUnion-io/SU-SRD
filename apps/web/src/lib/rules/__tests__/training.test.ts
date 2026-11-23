/** An ability's Training Point cost by its tier (Core Book p.224; SB-04). */

import { describe, expect, test } from 'bun:test'
import { nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { abilityNotYet, abilityRequirementsUnmet, abilityTrainingCost } from '../training'

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

describe('abilityRequirementsUnmet (Core Book p.23)', () => {
  const engineer = { classRef: 'Engineer', abilities: [] as string[] }

  test('the first ability of a Core tree asks nothing', () => {
    expect(abilityRequirementsUnmet(engineer, 'engineering-expertise')).toEqual([])
  })

  test('a level 3 ability with nothing learned in its tree names the levels missing', () => {
    const unmet = abilityRequirementsUnmet(engineer, 'mech-acquisition')
    expect(unmet).toHaveLength(1)
    expect(unmet[0]).toMatch(/level 1 and 2 of that tree/)
  })

  test('the next level of a tree in order asks nothing', () => {
    const pilot = { ...engineer, abilities: ['engineering-expertise'] }
    expect(abilityRequirementsUnmet(pilot, 'talk-shop')).toEqual([])
  })

  test('a break the pilot already has is not said again; one they have is asked nothing', () => {
    const pilot = { ...engineer, abilities: ['mech-acquisition'] }
    // Another tree's first ability: the standing break is not this pick's.
    expect(abilityRequirementsUnmet(pilot, 'jury-rig')).toEqual([])
    expect(abilityRequirementsUnmet(pilot, 'mech-acquisition')).toEqual([])
  })

  test('a Legendary ability on a new pilot names its bar', () => {
    const legendary = SalvageUnionReference.Abilities.all().find((a) => a.level === 'L')
    const unmet = legendary ? abilityRequirementsUnmet(engineer, nameToSlug(legendary.name)) : []
    expect(unmet.join(' ')).toMatch(/6 Core and 3 Advanced/)
  })
})

// r7 D5 (SB7-12): the trainer offered every ability, Advanced first, and warned only after.
describe('abilityNotYet (Core Book p.224)', () => {
  const engineer = { classRef: 'Engineer', abilities: [] as string[], trainingPoints: 1 }

  test('the next Core ability the pilot can pay for is learnable now', () => {
    expect(abilityNotYet(engineer, 'engineering-expertise')).toBeNull()
  })

  test('too few Training Points is why, with the price', () => {
    expect(abilityNotYet({ ...engineer, trainingPoints: 0 }, 'engineering-expertise')).toEqual({
      why: 'tp',
      cost: 1,
    })
  })

  test('out of its tree’s order, an Advanced or a Legendary one each say why', () => {
    expect(abilityNotYet(engineer, 'mech-acquisition')?.why).toBe('tree-order')
    const advanced = SalvageUnionReference.Abilities.all().find(
      (a) => a.level === 1 && abilityTrainingCost(nameToSlug(a.name)) === 2
    )
    const legendary = SalvageUnionReference.Abilities.all().find((a) => a.level === 'L')
    const rich = { ...engineer, trainingPoints: 9 }
    expect(advanced && abilityNotYet(rich, nameToSlug(advanced.name))?.why).toBe('advanced')
    expect(legendary && abilityNotYet(rich, nameToSlug(legendary.name))?.why).toBe('legendary')
  })

  test('one already learned, or a generic one with no price, is never “not yet”', () => {
    const has = { ...engineer, trainingPoints: 0, abilities: ['engineering-expertise'] }
    expect(abilityNotYet(has, 'engineering-expertise')).toBeNull()
    expect(abilityNotYet(engineer, 'no-such-ability')).toBeNull()
  })
})
