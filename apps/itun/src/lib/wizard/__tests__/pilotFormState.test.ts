/**
 * Unit tests for the pilot wizard form-state mappers (plan 3.1).
 *
 * The critical contract: pilotFormToUpdatePatch contains ONLY wizard-owned
 * fields — an edit save must never clobber live-play state.
 */
import { describe, expect, it } from 'bun:test'
import type { Pilot } from '../../schemas/pilot'
import {
  EMPTY_PILOT_FORM_STATE,
  pilotFormToCreateInput,
  pilotFormToUpdatePatch,
  pilotToFormState,
} from '../pilotFormState'

const storedPilot: Pilot = {
  id: 'p-1',
  schemaVersion: 1,
  name: 'Mira Voss',
  callsign: 'Sparks',
  classRef: 'class-engineer',
  abilities: ['a-1', 'a-2'],
  equipment: ['e-1'],
  motto: 'Measure twice',
  keepsake: 'A bent wrench',
  appearance: 'Grease-stained',
  background: 'Workshop kid.',
  conditions: ['exposed'],
  currentHP: 7,
  currentAP: 3,
  trainingPoints: 2,
  injuries: [{ severity: 'minor', note: 'sprain' }],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('pilotToFormState', () => {
  it('maps every wizard-owned field from the stored pilot', () => {
    const form = pilotToFormState(storedPilot)
    expect(form).toEqual({
      name: 'Mira Voss',
      classId: 'class-engineer',
      abilities: ['a-1', 'a-2'],
      equipment: ['e-1'],
      callsign: 'Sparks',
      motto: 'Measure twice',
      keepsake: 'A bent wrench',
      appearance: 'Grease-stained',
      background: 'Workshop kid.',
      description: '',
    })
  })

  it('copies arrays — mutating the form never mutates the entity', () => {
    const form = pilotToFormState(storedPilot)
    form.abilities.push('a-3')
    expect(storedPilot.abilities).toEqual(['a-1', 'a-2'])
  })
})

describe('pilotFormToUpdatePatch', () => {
  it('contains exactly the wizard-owned fields (no live-play state)', () => {
    const patch = pilotFormToUpdatePatch(pilotToFormState(storedPilot))
    expect(Object.keys(patch).sort()).toEqual([
      'abilities',
      'appearance',
      'background',
      'callsign',
      'classRef',
      'description',
      'equipment',
      'keepsake',
      'motto',
      'name',
    ])
  })

  it('trims string fields', () => {
    const patch = pilotFormToUpdatePatch({
      ...EMPTY_PILOT_FORM_STATE,
      name: '  Mira  ',
      callsign: ' Sparks ',
    })
    expect(patch.name).toBe('Mira')
    expect(patch.callsign).toBe('Sparks')
  })
})

describe('pilotFormToCreateInput', () => {
  it('seeds a fresh pilot at full base HP/AP with empty live-play state', () => {
    const input = pilotFormToCreateInput({
      ...EMPTY_PILOT_FORM_STATE,
      name: 'Mira Voss',
      callsign: 'Sparks',
      classId: 'class-engineer',
    })
    expect(input.schemaVersion).toBe(1)
    expect(input.currentHP).toBe(10)
    expect(input.currentAP).toBe(5)
    expect(input.conditions).toEqual([])
    expect(input.classRef).toBe('class-engineer')
    // No partner-granting equipment, so the field stays absent entirely.
    expect(input).not.toHaveProperty('partners')
  })

  it('grants a live partner for equipment carrying a stat block, not an inert card', () => {
    const input = pilotFormToCreateInput({
      ...EMPTY_PILOT_FORM_STATE,
      name: 'Mira Voss',
      callsign: 'Sparks',
      classId: 'class-engineer',
      equipment: ['cutting-torch', 'survey-drone'],
    })
    expect(input.partners).toHaveLength(1)
    expect(input.partners?.[0]?.hostRef).toBe('survey-drone')
    // `equipment` resolves the PLAYER's Survey Drone, never the opposition
    // stat block of the same name in drones.json.
    expect(input.partners?.[0]?.hostSchema).toBe('equipment')
    // Ordinary gear stays ordinary gear.
    expect(input.equipment).toContain('cutting-torch')
  })
})
