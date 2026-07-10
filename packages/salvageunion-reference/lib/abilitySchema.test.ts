import { describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from './index.js'

/** Narrow away null/undefined; throws (failing the test) when the value is missing. */
function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('Expected value to be defined')
  }
  return value
}

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

  it('grants field is only present on 14 abilities', () => {
    const abilities = SalvageUnionReference.Abilities.all()

    const withGrants = abilities.filter((a) => a.grants !== undefined)
    expect(withGrants.length).toBe(14)

    // Verify the abilities that have it
    const names = withGrants.map((a) => a.name).sort()
    expect(names).toEqual([
      'Auto-Turret',
      'Camo Suit',
      'Custom Missile Launcher',
      'Custom Sniper Rifle',
      'Hacking Kit',
      'Holo Companion',
      'Knife Missile',
      'Mecha Companion',
      'Mecha Packmaster',
      'Miniaturised EMP',
      'Stealth Field Generator',
      'Survey Drone',
      'Teleport Beacon',
      'Wingsuit',
    ])
  })

  it('activationCurrency is only present on 1 ability', () => {
    const abilities = SalvageUnionReference.Abilities.all()

    const withActivationCurrency = abilities.filter((a) => a.activationCurrency !== undefined)
    expect(withActivationCurrency.length).toBe(1)

    // Verify the ability that has it
    expect(defined(withActivationCurrency[0]).name).toBe('Area Salvage')
    expect(defined(withActivationCurrency[0]).activationCurrency).toBe('Variable')
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
