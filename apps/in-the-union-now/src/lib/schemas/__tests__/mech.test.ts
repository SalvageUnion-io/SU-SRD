import { describe, expect, test } from 'bun:test'

import { MechSchema } from '../mech'

const validMech = {
  id: 'mech-001',
  schemaVersion: 1 as const,
  name: 'Iron Lurker',
  chassisRef: 'iron-mongrel',
  systems: ['system-plasma-torch'],
  modules: ['module-reinforced-hull'],
  cargo: [],
  conditions: [],
  createdAt: '2026-05-18T00:00:00.000Z',
  updatedAt: '2026-05-18T00:00:00.000Z',
}

function omit<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const copy = { ...obj }
  delete copy[key]
  return copy
}

describe('MechSchema', () => {
  test('happy path: parses a complete mech', () => {
    const result = MechSchema.parse(validMech)
    expect(result.id).toBe('mech-001')
    expect(result.chassisRef).toBe('iron-mongrel')
    expect(result.schemaVersion).toBe(1)
  })

  test('happy path: patternName is optional', () => {
    const result = MechSchema.parse({ ...validMech, patternName: 'rust-tide' })
    expect(result.patternName).toBe('rust-tide')
  })

  test('happy path: workspaceId is optional', () => {
    const result = MechSchema.parse({ ...validMech, workspaceId: 'ws-xyz' })
    expect(result.workspaceId).toBe('ws-xyz')
  })

  test('rejects missing required field: chassisRef', () => {
    expect(() => MechSchema.parse(omit(validMech, 'chassisRef'))).toThrow()
  })

  test('rejects missing required field: name', () => {
    expect(() => MechSchema.parse(omit(validMech, 'name'))).toThrow()
  })

  test('rejects empty name (min(1) constraint)', () => {
    expect(() => MechSchema.parse({ ...validMech, name: '' })).toThrow()
  })

  test('accepts non-empty name', () => {
    const result = MechSchema.parse({ ...validMech, name: 'Iron Lurker' })
    expect(result.name).toBe('Iron Lurker')
  })

  test('rejects invalid schemaVersion', () => {
    expect(() => MechSchema.parse({ ...validMech, schemaVersion: 0 })).toThrow()
  })

  test('rejects unknown fields (strict)', () => {
    expect(() => MechSchema.parse({ ...validMech, secretField: 'oops' })).toThrow()
  })
})
