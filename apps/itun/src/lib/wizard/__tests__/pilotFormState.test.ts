/** Unit tests for the pilot wizard form-state mappers (plan 3.1). */

import { describe, expect, it } from 'bun:test'
import { pilotMaxHP } from 'salvageunion-reference/rules'
import {
  EMPTY_PILOT_FORM_STATE,
  pilotFormToCreateInput,
  pilotFormToUpdatePatch,
} from '../pilotFormState'

describe('pilotFormToUpdatePatch', () => {
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

  it('seeds current HP/AP at the derived max, so a max-raising ability starts filled', () => {
    const input = pilotFormToCreateInput({
      ...EMPTY_PILOT_FORM_STATE,
      name: 'Mira Voss',
      callsign: 'Sparks',
      abilities: ['Bionic Arms'],
    })
    // Bionic Arms is +2 max HP; a new pilot is created at that max, not at 10.
    expect(input.currentHP).toBe(pilotMaxHP({ abilities: ['Bionic Arms'] }))
    expect(input.currentHP).toBe(12)
    expect(input.currentAP).toBe(5)
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
