import { describe, expect, test } from 'bun:test'
import { hasChassisModder, moddableChassisAbilities, moddedChassisAbility } from '../chassisModder'

describe('Chassis Modder (Core Book p.64)', () => {
  test('only a pilot holding the ability is a Chassis Modder', () => {
    expect(hasChassisModder(['chassis-modder'])).toBe(true)
    expect(hasChassisModder(['field-fabrication'])).toBe(false)
    expect(hasChassisModder(undefined)).toBe(false)
  })

  test('offers abilities of chassis the Crafting Bay could craft, less its own', () => {
    const tl1 = moddableChassisAbilities('mule', 1)
    expect(tl1).toContain('hover-drone') // Mazona, Tech 1
    expect(tl1).not.toContain('integrated-cargo-bay') // the Mule's own
    expect(tl1).not.toContain('fast') // Hussar, Tech 2
    expect(moddableChassisAbilities('mule', 2)).toContain('fast')
  })

  test('never offers a Bio-Titan or Nhurgal chassis ability', () => {
    const all = moddableChassisAbilities('mule', null)
    expect(all).toContain('integrated-mech-bay') // Carrier, Tech 5: no crawler reads any Tech Level
    expect(all).not.toContain('bio-chassis')
    expect(all).not.toContain('meld')
  })

  test('the added ability is in effect only while a Chassis Modder pilots it', () => {
    const mech = { chassisRef: 'mule', moddedChassisAbility: 'fast' }
    expect(moddedChassisAbility(mech, ['chassis-modder'])?.name).toBe('Fast')
    expect(moddedChassisAbility(mech, [])).toBeNull()
    expect(moddedChassisAbility({ chassisRef: 'mule' }, ['chassis-modder'])).toBeNull()
  })

  test('an ability the chassis already has is not added twice', () => {
    const mech = { chassisRef: 'hussar', moddedChassisAbility: 'fast' }
    expect(moddedChassisAbility(mech, ['chassis-modder'])).toBeNull()
  })
})
