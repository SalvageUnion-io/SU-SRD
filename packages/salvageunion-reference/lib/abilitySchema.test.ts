import { describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from './index.js'

describe('AbilitySchema optionality audit', () => {
  it('all abilities have an actions array (required field)', () => {
    const abilities = SalvageUnionReference.Abilities.all()
    expect(abilities.length).toBeGreaterThan(0)

    for (const ability of abilities) {
      expect(ability.actions).toBeDefined()
      expect(Array.isArray(ability.actions)).toBe(true)
      expect(ability.actions.length).toBeGreaterThan(0)
    }
  })

  it('actions field is always present and never empty', () => {
    const abilities = SalvageUnionReference.Abilities.all()

    const allHaveActions = abilities.every((a) => Array.isArray(a.actions) && a.actions.length > 0)
    expect(allHaveActions).toBe(true)
  })

  it('mechActionType is only present on 7 abilities', () => {
    const abilities = SalvageUnionReference.Abilities.all()

    const withMechActionType = abilities.filter((a) => a.mechActionType !== undefined)
    expect(withMechActionType.length).toBe(7)

    // Verify the abilities that have it
    const names = withMechActionType.map((a) => a.name).sort()
    expect(names).toEqual([
      'Area Salvage',
      'Load',
      'Mech Salvage',
      'Mount',
      'Patch Up',
      'Repair',
      'Scrap',
    ])
  })

  it('grants field is only present on 6 abilities', () => {
    const abilities = SalvageUnionReference.Abilities.all()

    const withGrants = abilities.filter((a) => a.grants !== undefined)
    expect(withGrants.length).toBe(6)

    // Verify the abilities that have it
    const names = withGrants.map((a) => a.name).sort()
    expect(names).toEqual([
      'Auto-Turret',
      'Custom Sniper Rifle',
      'Holo Companion',
      'Mecha Companion',
      'Mecha Packmaster',
      'Survey Drone',
    ])
  })

  it('activationCurrency is only present on 1 ability', () => {
    const abilities = SalvageUnionReference.Abilities.all()

    const withActivationCurrency = abilities.filter((a) => a.activationCurrency !== undefined)
    expect(withActivationCurrency.length).toBe(1)

    // Verify the ability that has it
    expect(withActivationCurrency[0]!.name).toBe('Area Salvage')
    expect(withActivationCurrency[0]!.activationCurrency).toBe('Variable')
  })

  it('description is present on 100 out of 103 abilities', () => {
    const abilities = SalvageUnionReference.Abilities.all()

    const withDescription = abilities.filter((a) => a.description !== undefined)
    expect(withDescription.length).toBe(100)

    const withoutDescription = abilities.filter((a) => a.description === undefined)
    expect(withoutDescription.length).toBe(3)

    // Verify which abilities are missing it
    const names = withoutDescription.map((a) => a.name).sort()
    expect(names).toEqual(['Load', 'Mount', 'Patch Up'])
  })
})
