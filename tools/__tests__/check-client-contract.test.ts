import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import type { Contract, ValidatorJSON } from '../check-client-contract'
import { breaksBetween, refusals, SNAPSHOT_PATH, verdict } from '../check-client-contract'

const str: ValidatorJSON = { type: 'string' }
const num: ValidatorJSON = { type: 'number' }
const nul: ValidatorJSON = { type: 'null' }
const lit = (value: unknown): ValidatorJSON => ({ type: 'literal', value })
const union = (...value: ValidatorJSON[]): ValidatorJSON => ({ type: 'union', value })
const obj = (
  fields: Record<string, ValidatorJSON | [ValidatorJSON, 'optional']>
): ValidatorJSON => ({
  type: 'object',
  value: Object.fromEntries(
    Object.entries(fields).map(([k, f]) =>
      Array.isArray(f)
        ? [k, { fieldType: f[0], optional: true }]
        : [k, { fieldType: f, optional: false }]
    )
  ),
})

describe('refusals', () => {
  it('replays ITUN-CONVEX-9: a new required argument breaks an older tab', () => {
    const before = obj({ appId: str, expectedUpdatedAt: [union(num, nul), 'optional'] })
    const after = obj({ appId: str, expectedUpdatedAt: union(num, nul) })
    expect(refusals(before, after, 'entities:upsertByAppId')).toEqual([
      'entities:upsertByAppId.expectedUpdatedAt: became required',
    ])
    expect(refusals(obj({ appId: str }), after, 'f')).toEqual([
      'f.expectedUpdatedAt: new required argument, which an older tab never sends',
    ])
  })

  it('lets a new optional argument through', () => {
    expect(refusals(obj({ a: str }), obj({ a: str, b: [num, 'optional'] }), 'f')).toEqual([])
  })

  it('refuses a removed field, which an older tab may still send', () => {
    expect(refusals(obj({ a: str, b: [num, 'optional'] }), obj({ a: str }), 'f')).toEqual([
      'f.b: removed, and an older tab may still send it',
    ])
  })

  it('refuses a narrowed union and allows a widened one', () => {
    const two = union(lit('pilots'), lit('mechs'))
    const one = union(lit('pilots'))
    expect(refusals(two, one, 'f')).toEqual(['f: "mechs" is no longer accepted (now "pilots")'])
    expect(refusals(one, two, 'f')).toEqual([])
  })

  it('treats a widened type as compatible', () => {
    expect(refusals(lit('x'), str, 'f')).toEqual([])
    expect(refusals({ type: 'id', tableName: 'games' }, str, 'f')).toEqual([])
    expect(refusals(num, { type: 'any' }, 'f')).toEqual([])
    expect(refusals(num, union(num, nul), 'f')).toEqual([])
  })

  it('refuses a narrowed type', () => {
    expect(refusals({ type: 'any' }, str, 'f')).toHaveLength(1)
    expect(refusals(str, lit('x'), 'f')).toHaveLength(1)
    expect(refusals(str, { type: 'id', tableName: 'games' }, 'f')).toHaveLength(1)
    expect(
      refusals({ type: 'id', tableName: 'games' }, { type: 'id', tableName: 'users' }, 'f')
    ).toHaveLength(1)
  })

  it('names the changed field inside a union of objects', () => {
    const before = union(obj({ kind: lit('a'), x: str }), obj({ kind: lit('b') }))
    const after = union(obj({ kind: lit('a'), x: str, y: num }), obj({ kind: lit('b') }))
    expect(refusals(before, after, 'f')).toEqual([
      'f.y: new required argument, which an older tab never sends',
    ])
  })

  it('looks inside arrays', () => {
    const before: ValidatorJSON = { type: 'array', value: obj({ a: str }) }
    const after: ValidatorJSON = { type: 'array', value: obj({ a: str, b: num }) }
    expect(refusals(before, after, 'f')).toEqual([
      'f[].b: new required argument, which an older tab never sends',
    ])
  })
})

describe('breaksBetween', () => {
  it('refuses a deleted function and allows a new one', () => {
    const prev: Contract = { 'games:rename': obj({}) }
    const next: Contract = { 'games:create': obj({}) }
    expect(breaksBetween(prev, next)).toEqual([
      'games:rename: deleted or renamed, and an older tab may still call it',
    ])
    expect(breaksBetween(next, { ...next, ...prev })).toEqual([])
  })
})

describe('verdict', () => {
  const prev: Contract = { 'm:f': obj({ a: str }) }
  const breaking: Contract = { 'm:f': obj({ a: str, b: num }) }
  const compatible: Contract = { 'm:f': obj({ a: str, b: [num, 'optional'] }) }

  it('passes an unchanged contract without a write', () => {
    expect(verdict({ floor: 10, functions: prev }, prev, 10)).toEqual({
      ok: true,
      write: false,
      message: 'compatible',
    })
  })

  it('fails a breaking change at the same floor, and names the fix', () => {
    const result = verdict({ floor: 10, functions: prev }, breaking, 10)
    expect(result.ok).toBe(false)
    expect(result.message).toContain('m:f.b: new required argument')
    expect(result.message).toContain('raise BUILD_FLOOR')
  })

  it('accepts a breaking change once the floor is raised, as a write', () => {
    expect(verdict({ floor: 10, functions: prev }, breaking, 20)).toMatchObject({
      ok: true,
      write: true,
    })
  })

  it('needs no raise for a compatible change, only a write', () => {
    expect(verdict({ floor: 10, functions: prev }, compatible, 10)).toMatchObject({
      ok: true,
      write: true,
    })
  })

  it('refuses a lowered floor', () => {
    expect(verdict({ floor: 10, functions: prev }, prev, 5).ok).toBe(false)
  })
})

describe('the committed snapshot', () => {
  it('records upsertByAppId with expectedUpdatedAt required', () => {
    const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'))
    const args = snapshot.functions['entities:upsertByAppId']
    expect(args.value.expectedUpdatedAt.optional).toBe(false)
  })
})
