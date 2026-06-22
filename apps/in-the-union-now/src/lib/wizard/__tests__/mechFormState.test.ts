/**
 * Unit tests for the mech wizard form-state mappers (plan 3.1).
 *
 * The critical contract: mechFormToUpdatePatch contains ONLY wizard-owned
 * fields — an edit save must never clobber live-play state (currents,
 * conditions, item condition/uses maps, maxima modifiers).
 */
import { beforeAll, describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { Mech } from '../../schemas/mech'
import {
  EMPTY_MECH_FORM_STATE,
  mechFormToCreateInput,
  mechFormToUpdatePatch,
  mechToFormState,
} from '../mechFormState'

beforeAll(async () => {
  await SalvageUnionReference.preload(['chassis'])
})

const storedMech: Mech = {
  id: 'm-1',
  schemaVersion: 1,
  name: 'Iron Fist',
  chassisRef: 'Mule',
  systems: ['Cargo Pod', 'Armour Plating'],
  modules: ['Comms Module'],
  cargoLots: [
    {
      id: 'lot-1',
      kind: 'bulk',
      name: 'Tech 2 Scrap',
      cat: 'SCRAP',
      tl: 2,
      qty: 3,
      units: 3,
      code: 'SCR-T2',
    },
  ],
  conditions: ['Vulnerable'],
  maxSpModifier: 5,
  maxHeatModifier: 1,
  currentSP: 9,
  currentEP: 2,
  currentHeat: 4,
  systemConditions: { 'Cargo Pod': 'damaged' },
  itemUses: { 'Cargo Pod': 1 },
  shutdown: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('mechToFormState', () => {
  it('maps every wizard-owned field from the stored mech', () => {
    const form = mechToFormState(storedMech)
    expect(form).toEqual({
      name: 'Iron Fist',
      chassisName: 'Mule',
      patternName: '',
      systems: ['Cargo Pod', 'Armour Plating'],
      modules: ['Comms Module'],
      cargoLots: storedMech.cargoLots,
    })
  })

  it('copies arrays and lots — mutating the form never mutates the entity', () => {
    const form = mechToFormState(storedMech)
    form.systems.push('Floodlights')
    form.cargoLots[0]!.units = 99
    expect(storedMech.systems).toEqual(['Cargo Pod', 'Armour Plating'])
    expect(storedMech.cargoLots[0]!.units).toBe(3)
  })
})

describe('mechFormToUpdatePatch', () => {
  it('contains exactly the wizard-owned fields (no live-play state)', () => {
    const patch = mechFormToUpdatePatch(mechToFormState(storedMech))
    expect(Object.keys(patch).sort()).toEqual([
      'cargoLots',
      'chassisRef',
      'modules',
      'name',
      'patternName',
      'systems',
    ])
  })

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

  it('round-trips patternName off a stored mech', () => {
    const form = mechToFormState({ ...storedMech, patternName: 'Hauler Pattern' })
    expect(form.patternName).toBe('Hauler Pattern')
  })
})

describe('mechFormToCreateInput', () => {
  it('seeds a fresh mech at full chassis SP/EP with Heat 0', () => {
    const mule = SalvageUnionReference.Chassis.find((c) => c.name === 'Mule')
    expect(mule).toBeDefined()

    const input = mechFormToCreateInput({
      ...EMPTY_MECH_FORM_STATE,
      name: 'Iron Fist',
      chassisName: 'Mule',
    })
    expect(input.schemaVersion).toBe(1)
    expect(input.chassisRef).toBe('Mule')
    expect(input.currentSP).toBe(mule!.structurePoints)
    expect(input.currentEP).toBe(mule!.energyPoints)
    expect(input.currentHeat).toBe(0)
    expect(input.conditions).toEqual([])
  })
})
