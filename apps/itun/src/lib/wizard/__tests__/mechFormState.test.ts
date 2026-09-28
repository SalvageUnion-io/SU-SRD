/** Unit tests for the mech wizard form-state mappers (plan 3.1). */
import { describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import {
  EMPTY_MECH_FORM_STATE,
  mechFormToCreateInput,
  mechFormToUpdatePatch,
} from '../mechFormState'

describe('mechFormToUpdatePatch', () => {
  it('trims the name', () => {
    const patch = mechFormToUpdatePatch({
      ...EMPTY_MECH_FORM_STATE,
      name: '  Iron Fist  ',
      chassisName: 'Mule',
    })
    expect(patch.name).toBe('Iron Fist')
  })

  it('carries the pattern name (canonical or custom), undefined when blank', () => {
    expect(
      mechFormToUpdatePatch({ ...EMPTY_MECH_FORM_STATE, patternName: 'Hauler Pattern' }).patternName
    ).toBe('Hauler Pattern')
    expect(
      mechFormToUpdatePatch({ ...EMPTY_MECH_FORM_STATE, patternName: '   ' }).patternName
    ).toBeUndefined()
  })
})

describe('mechFormToCreateInput', () => {
  it('seeds a fresh mech at full chassis SP/EP with Heat 0', () => {
    const mule = SalvageUnionReference.Chassis.getByName('Mule')
    expect(mule).toBeDefined()
    if (!mule) throw new Error('expected the Mule chassis in reference data')

    const input = mechFormToCreateInput({
      ...EMPTY_MECH_FORM_STATE,
      name: 'Iron Fist',
      chassisName: 'Mule',
    })
    expect(input.schemaVersion).toBe(1)
    expect(input.chassisRef).toBe('Mule')
    expect(input.currentSP).toBe(mule.structurePoints)
    expect(input.currentEP).toBe(mule.energyPoints)
    expect(input.currentHeat).toBe(0)
    expect(input.conditions).toEqual([])
  })

  it('grants no partners to a chassis whose ability does not field a drone', () => {
    const input = mechFormToCreateInput({
      ...EMPTY_MECH_FORM_STATE,
      name: 'Iron Fist',
      chassisName: 'Mule',
    })
    // Absent, not an empty array — the field only exists when it means something.
    expect(input).not.toHaveProperty('partners')
  })

  it('seeds the drone a chassis ability grants, kitted by the chosen pattern', () => {
    // The regression this closes: building a Little Sestra used to silently drop
    // its Sestra Drone, because nothing in the app ever created a partner.
    const input = mechFormToCreateInput({
      ...EMPTY_MECH_FORM_STATE,
      name: 'Custos',
      chassisName: 'little-sestra',
      patternName: 'Surveyor',
    })
    expect(input.partners).toHaveLength(1)
    const [drone] = input.partners ?? []
    expect(drone?.hostRef).toBe('sestra-drone')
    expect(drone?.hostSchema).toBe('drones')
    expect(drone?.id).toBeTruthy()
    expect(drone?.systems).toContain('long-barrelled-green-laser')
    // Integrated hardware rides along with the pattern's picks.
    expect(drone?.systems).toContain('hover-locomotion-system')
  })

  it('seeds all FOUR of Big Brother/DronTek, each under its own instance name', () => {
    const input = mechFormToCreateInput({
      ...EMPTY_MECH_FORM_STATE,
      name: 'Panopticon',
      chassisName: 'big-brother',
      patternName: 'DronTek',
    })
    expect(input.partners).toHaveLength(4)
    expect((input.partners ?? []).map((p) => p.name)).toEqual([
      'Shield Drone',
      'Anti-Missile Drone',
      'Fire Support Drone',
      'Minelayer Drone',
    ])
    // Distinct ids, or they would collide in the host's array.
    expect(new Set((input.partners ?? []).map((p) => p.id)).size).toBe(4)
  })
})
