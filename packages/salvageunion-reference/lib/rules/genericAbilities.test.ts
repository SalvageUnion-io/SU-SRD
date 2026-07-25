import { beforeAll, describe, expect, it } from 'bun:test'

import { SalvageUnionReference } from '../index.js'
import { isLegalCreationAbility } from './creation.js'
import { GENERIC_ABILITY_TREE, genericAbilities, isGenericAbility } from './genericAbilities.js'

describe('genericAbilities', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload(['abilities'])
  })

  it('is the eight universal abilities from core book p.248-249', () => {
    const found = genericAbilities(SalvageUnionReference.Abilities.all())

    expect(found.map((a) => a.name).sort()).toEqual([
      'Area Salvage',
      'Craft',
      'Load',
      'Mech Salvage',
      'Mount',
      'Patch Up',
      'Repair',
      'Scrap',
    ])
  })

  it('classifies by tree', () => {
    expect(isGenericAbility({ tree: GENERIC_ABILITY_TREE })).toBe(true)
    expect(isGenericAbility({ tree: 'Mechanical Knowledge' })).toBe(false)
  })

  // The load-bearing reason these are derived rather than seeded onto a pilot:
  // they are not pickable, so they were never meant to occupy a creation pick.
  it('none of them is a legal creation pick under any core tree', () => {
    const all = SalvageUnionReference.Abilities.all()
    const everyTree = [...new Set(all.map((a) => a.tree))]

    for (const ability of genericAbilities(all)) {
      expect(isLegalCreationAbility(ability, everyTree)).toBe(false)
    }
  })

  it('leaves learned class abilities out', () => {
    const all = SalvageUnionReference.Abilities.all()
    const found = genericAbilities(all)

    expect(found.length).toBeLessThan(all.length)
    expect(found.some((a) => a.name === 'Jury Rig')).toBe(false)
  })
})
