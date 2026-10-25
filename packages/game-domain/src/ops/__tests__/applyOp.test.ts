import { describe, expect, test } from 'bun:test'
import type { OpInput } from '../applyOp'
import { applyOp, diffBodies, isEmptyOp, unitOf } from '../applyOp'

const crawler = {
  id: 'crawler-001',
  schemaVersion: 1 as const,
  name: 'The Wandering Throne',
  techLevel: 'tech-2',
  systems: ['system-drill'],
  createdAt: '2026-05-18T00:00:00.000Z',
  updatedAt: '2026-05-18T00:00:00.000Z',
}

function op(patch: Record<string, unknown>, rest: Partial<OpInput> = {}): OpInput {
  return {
    id: 'op-1',
    unitId: 'crawler-001',
    baseSeq: 0,
    at: 1,
    kind: 'manual',
    source: 'test',
    patch,
    ...rest,
  }
}

describe('applyOp', () => {
  test('applies a patch: the next seq, the field it wrote, and what it held', () => {
    const result = applyOp(unitOf('crawler', crawler), op({ name: 'Throne II' }))
    if (!result.ok) throw new Error(result.reason)
    expect(result.seq).toBe(1)
    expect(result.unit.headSeq).toBe(1)
    expect(result.unit.body.name).toBe('Throne II')
    expect(result.unit.fieldSeqs).toEqual({ name: 1 })
    expect(result.before).toEqual({ name: 'The Wandering Throne' })
  })

  test('unset removes a field and records what it held', () => {
    const unit = unitOf('crawler', { ...crawler, maxSpOverride: 30 })
    const result = applyOp(unit, op({}, { unset: ['maxSpOverride'] }))
    if (!result.ok) throw new Error(result.reason)
    expect('maxSpOverride' in result.unit.body).toBe(false)
    expect(result.before).toEqual({ maxSpOverride: 30 })
  })

  test('refuses a field an op after its base already wrote', () => {
    const unit = unitOf('crawler', crawler, 3, { name: 3 })
    expect(applyOp(unit, op({ name: 'Mine' }, { baseSeq: 2 }))).toEqual({
      ok: false,
      reason: 'conflict',
      fields: ['name'],
    })
  })

  test('merges a field nobody else wrote, whatever else moved', () => {
    const unit = unitOf('crawler', crawler, 3, { name: 3 })
    const result = applyOp(unit, op({ techLevel: 'tech-3' }, { baseSeq: 1 }))
    expect(result.ok).toBe(true)
  })

  test('a null base and the updatedAt stamp never conflict', () => {
    const unit = unitOf('crawler', crawler, 3, { name: 3 })
    expect(applyOp(unit, op({ name: 'Mine' }, { baseSeq: null })).ok).toBe(true)
    const stamped = applyOp(unit, op({ updatedAt: '2026-10-25T00:00:00.000Z' }, { baseSeq: 1 }))
    if (!stamped.ok) throw new Error(stamped.reason)
    expect(stamped.unit.fieldSeqs).toEqual({ name: 3 })
  })

  test('refuses a result that does not parse, and an id change', () => {
    const unit = unitOf('crawler', crawler)
    expect(applyOp(unit, op({ techLevel: 7 })).ok).toBe(false)
    expect(applyOp(unit, op({ id: 'other' }))).toMatchObject({ ok: false, reason: 'invalid' })
  })
})

describe('diffBodies', () => {
  test('names only what moved, and what went', () => {
    const { patch, unset } = diffBodies({ a: 1, b: [1, 2], c: 'x' }, { a: 1, b: [1, 3], d: true })
    expect(patch).toEqual({ b: [1, 3], d: true })
    expect(unset).toEqual(['c'])
  })
})

describe('isEmptyOp', () => {
  test('a stamp alone changes nothing', () => {
    expect(isEmptyOp({ patch: { updatedAt: 'now' } })).toBe(true)
    expect(isEmptyOp({ patch: {}, unset: ['name'] })).toBe(false)
  })
})

describe('applyOp unset', () => {
  test('refuses a field the schema does not define', () => {
    expect(applyOp(unitOf('crawler', crawler), op({}, { unset: ['notAField'] }))).toEqual({
      ok: false,
      reason: 'invalid',
      message: 'cannot unset unknown field "notAField"',
    })
  })
})
