import { describe, expect, test } from 'bun:test'
import { PilotSchema } from 'cantina-domain/schemas/pilot'
import {
  PILOT_CREATION_ABILITY_PICKS,
  PILOT_CREATION_EQUIPMENT_PICKS,
} from 'salvageunion-reference/rules'

const validPilot = {
  id: 'pilot-001',
  schemaVersion: 1 as const,
  name: 'Yara Voss',
  callsign: 'Ghost',
  classRef: 'scavenger',
  abilities: ['ability-scrap', 'ability-jury-rig'],
  equipment: ['item-pistol', 'item-med-kit'],
  motto: 'Everything burns.',
  keepsake: 'A broken compass.',
  appearance: 'Tall, with oil-stained overalls.',
  conditions: [],
  createdAt: '2026-05-18T00:00:00.000Z',
  updatedAt: '2026-05-18T00:00:00.000Z',
}

function omit<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const copy = { ...obj }
  delete copy[key]
  return copy
}

describe('PilotSchema', () => {
  test('happy path: parses a complete pilot', () => {
    const result = PilotSchema.parse(validPilot)
    expect(result.id).toBe('pilot-001')
    expect(result.callsign).toBe('Ghost')
    expect(result.schemaVersion).toBe(1)
  })

  test('rejects missing required field: name', () => {
    expect(() => PilotSchema.parse(omit(validPilot, 'name'))).toThrow()
  })

  test('rejects missing required field: classRef', () => {
    expect(() => PilotSchema.parse(omit(validPilot, 'classRef'))).toThrow()
  })

  test('rejects missing required field: createdAt', () => {
    expect(() => PilotSchema.parse(omit(validPilot, 'createdAt'))).toThrow()
  })

  test('rejects invalid schemaVersion', () => {
    expect(() => PilotSchema.parse({ ...validPilot, schemaVersion: 2 })).toThrow()
  })

  test('rejects unknown fields (strict)', () => {
    expect(() => PilotSchema.parse({ ...validPilot, unknownField: true })).toThrow()
  })

  test('rejects invalid datetime format for createdAt', () => {
    expect(() => PilotSchema.parse({ ...validPilot, createdAt: 'not-a-date' })).toThrow()
  })

  // Schema hardening: name/callsign must be non-empty
  test('rejects empty name', () => {
    expect(() => PilotSchema.parse({ ...validPilot, name: '' })).toThrow()
  })

  test('rejects empty callsign', () => {
    expect(() => PilotSchema.parse({ ...validPilot, callsign: '' })).toThrow()
  })

  // Advancement: the schema does not cap abilities — growth past
  // the creation budget persists; the rules cap (10/12) is a SOFT warning.
  test(`accepts abilities array exceeding PILOT_CREATION_ABILITY_PICKS (${PILOT_CREATION_ABILITY_PICKS})`, () => {
    const grown = Array.from({ length: PILOT_CREATION_ABILITY_PICKS + 1 }, (_, i) => `ability-${i}`)
    const result = PilotSchema.parse({ ...validPilot, abilities: grown })
    expect(result.abilities).toHaveLength(PILOT_CREATION_ABILITY_PICKS + 1)
  })

  test(`accepts abilities array exactly at PILOT_CREATION_ABILITY_PICKS (${PILOT_CREATION_ABILITY_PICKS})`, () => {
    const atMax = Array.from({ length: PILOT_CREATION_ABILITY_PICKS }, (_, i) => `ability-${i}`)
    const result = PilotSchema.parse({ ...validPilot, abilities: atMax })
    expect(result.abilities).toHaveLength(PILOT_CREATION_ABILITY_PICKS)
  })

  // Equipment is likewise uncapped at the schema level.
  test(`accepts equipment array exceeding PILOT_CREATION_EQUIPMENT_PICKS (${PILOT_CREATION_EQUIPMENT_PICKS})`, () => {
    const grown = Array.from({ length: PILOT_CREATION_EQUIPMENT_PICKS + 1 }, (_, i) => `item-${i}`)
    const result = PilotSchema.parse({ ...validPilot, equipment: grown })
    expect(result.equipment).toHaveLength(PILOT_CREATION_EQUIPMENT_PICKS + 1)
  })

  test(`accepts equipment array exactly at PILOT_CREATION_EQUIPMENT_PICKS (${PILOT_CREATION_EQUIPMENT_PICKS})`, () => {
    const atMax = Array.from({ length: PILOT_CREATION_EQUIPMENT_PICKS }, (_, i) => `item-${i}`)
    const result = PilotSchema.parse({ ...validPilot, equipment: atMax })
    expect(result.equipment).toHaveLength(PILOT_CREATION_EQUIPMENT_PICKS)
  })
})
