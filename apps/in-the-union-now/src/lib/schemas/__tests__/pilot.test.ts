import { describe, expect, test } from 'bun:test'

import { PilotSchema } from '../pilot'

const validPilot = {
  id: 'pilot-001',
  schemaVersion: 1 as const,
  name: 'Yara Voss',
  callsign: 'Ghost',
  classRef: 'scavenger',
  abilities: ['ability-scrap', 'ability-jury-rig'],
  equipment: ['item-pistol', 'item-med-kit'],
  rollResults: [],
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

  test('happy path: workspaceId is optional', () => {
    const result = PilotSchema.parse({ ...validPilot, workspaceId: 'ws-abc' })
    expect(result.workspaceId).toBe('ws-abc')
  })

  test('happy path: workspaceId absent is fine', () => {
    const result = PilotSchema.parse(validPilot)
    expect(result.workspaceId).toBeUndefined()
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
})
