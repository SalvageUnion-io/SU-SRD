import { describe, expect, test } from 'bun:test'

import { SoftLinkSchema } from '../softLink'

const validSoftLink = {
  id: 'link-001',
  from: { type: 'mech' as const, id: 'mech-001' },
  to: { type: 'pilot' as const, id: 'pilot-001' },
  type: 'mech-to-pilot' as const,
  createdAt: '2026-05-18T00:00:00.000Z',
}

function omit<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const copy = { ...obj }
  delete copy[key]
  return copy
}

describe('SoftLinkSchema', () => {
  test('happy path: parses a mech-to-pilot link', () => {
    const result = SoftLinkSchema.parse(validSoftLink)
    expect(result.id).toBe('link-001')
    expect(result.type).toBe('mech-to-pilot')
    expect(result.from.type).toBe('mech')
    expect(result.to.type).toBe('pilot')
  })

  test('happy path: parses a pilot-to-crawler link', () => {
    const link = {
      id: 'link-002',
      from: { type: 'pilot' as const, id: 'pilot-001' },
      to: { type: 'crawler' as const, id: 'crawler-001' },
      type: 'pilot-to-crawler' as const,
      createdAt: '2026-05-18T00:00:00.000Z',
    }
    const result = SoftLinkSchema.parse(link)
    expect(result.type).toBe('pilot-to-crawler')
  })

  test('rejects missing required field: from', () => {
    expect(() => SoftLinkSchema.parse(omit(validSoftLink, 'from'))).toThrow()
  })

  test('rejects missing required field: to', () => {
    expect(() => SoftLinkSchema.parse(omit(validSoftLink, 'to'))).toThrow()
  })

  test('rejects invalid link type', () => {
    expect(() => SoftLinkSchema.parse({ ...validSoftLink, type: 'pilot-to-mech' })).toThrow()
  })

  test('rejects unknown fields on root (strict)', () => {
    expect(() => SoftLinkSchema.parse({ ...validSoftLink, extra: 'field' })).toThrow()
  })

  test('rejects unknown fields on from ref (strict)', () => {
    expect(() =>
      SoftLinkSchema.parse({
        ...validSoftLink,
        from: { type: 'mech', id: 'mech-001', extra: 'nope' },
      })
    ).toThrow()
  })

  test('rejects invalid EntityRef type in from', () => {
    expect(() =>
      SoftLinkSchema.parse({
        ...validSoftLink,
        from: { type: 'spaceship', id: 'x' },
      })
    ).toThrow()
  })
})
