import { describe, expect, test } from 'bun:test'

import { WorkspaceSchema } from '../workspace'

const validWorkspace = {
  id: 'ws-001',
  schemaVersion: 1 as const,
  name: 'Campaign Alpha',
  createdAt: '2026-05-18T00:00:00.000Z',
}

function omit<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const copy = { ...obj }
  delete copy[key]
  return copy
}

describe('WorkspaceSchema', () => {
  test('happy path: parses a complete workspace', () => {
    const result = WorkspaceSchema.parse(validWorkspace)
    expect(result.id).toBe('ws-001')
    expect(result.name).toBe('Campaign Alpha')
    expect(result.schemaVersion).toBe(1)
  })

  test('rejects missing required field: name', () => {
    expect(() => WorkspaceSchema.parse(omit(validWorkspace, 'name'))).toThrow()
  })

  test('rejects missing required field: createdAt', () => {
    expect(() => WorkspaceSchema.parse(omit(validWorkspace, 'createdAt'))).toThrow()
  })

  test('rejects invalid schemaVersion', () => {
    expect(() => WorkspaceSchema.parse({ ...validWorkspace, schemaVersion: 2 })).toThrow()
  })

  test('rejects unknown fields (strict)', () => {
    expect(() =>
      WorkspaceSchema.parse({ ...validWorkspace, updatedAt: '2026-05-18T00:00:00.000Z' })
    ).toThrow()
  })

  test('rejects invalid datetime for createdAt', () => {
    expect(() => WorkspaceSchema.parse({ ...validWorkspace, createdAt: '2026-05-18' })).toThrow()
  })
})
