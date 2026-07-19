import { describe, expect, test } from 'bun:test'

import { EntityRefSchema } from '../entity'

describe('EntityRefSchema', () => {
  test('happy path: parses a pilot ref', () => {
    const result = EntityRefSchema.parse({ type: 'pilot', id: 'abc-123' })
    expect(result).toEqual({ type: 'pilot', id: 'abc-123' })
  })

  test('happy path: parses a mech ref', () => {
    const result = EntityRefSchema.parse({ type: 'mech', id: 'mech-456' })
    expect(result).toEqual({ type: 'mech', id: 'mech-456' })
  })

  test('happy path: parses a crawler ref', () => {
    const result = EntityRefSchema.parse({ type: 'crawler', id: 'crawler-789' })
    expect(result).toEqual({ type: 'crawler', id: 'crawler-789' })
  })

  test('rejects missing type', () => {
    expect(() => EntityRefSchema.parse({ id: 'abc-123' })).toThrow()
  })

  test('rejects missing id', () => {
    expect(() => EntityRefSchema.parse({ type: 'pilot' })).toThrow()
  })

  test('rejects invalid type value', () => {
    expect(() => EntityRefSchema.parse({ type: 'spaceship', id: 'abc' })).toThrow()
  })

  test('rejects unknown fields (strict)', () => {
    expect(() => EntityRefSchema.parse({ type: 'pilot', id: 'abc', extra: 'field' })).toThrow()
  })
})
