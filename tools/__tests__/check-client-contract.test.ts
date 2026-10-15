import { describe, expect, it, spyOn, test } from 'bun:test'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Contract, ValidatorJSON } from '../check-client-contract'
import { breaksBetween, main, refusals, SNAPSHOT_PATH, verdict } from '../check-client-contract'
import { captured, fixtureTrees } from './fixtureTree'

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
  it('replays CANTINA-CONVEX-9: a new required argument breaks an older tab', () => {
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

describe('refusals on records and rendered messages', () => {
  const rec = (keys: ValidatorJSON, value: ValidatorJSON): ValidatorJSON => ({
    type: 'record',
    keys,
    values: { fieldType: value, optional: false },
  })

  it("checks a record's keys and values separately, naming which one narrowed", () => {
    expect(refusals(rec(str, num), rec(str, union(num, nul)), 'f')).toEqual([])
    expect(refusals(rec(str, num), rec(lit('a'), str), 'f')).toEqual([
      'f{key}: string is no longer accepted (now "a")',
      'f{value}: number is no longer accepted (now string)',
    ])
  })

  it('refuses a record that became something else', () => {
    expect(refusals(rec(str, num), obj({}), 'f')).toEqual([
      'f: record is no longer accepted (now object)',
    ])
  })

  it('renders a bigint literal with its n suffix and accepts it as a bigint', () => {
    const big = lit({ $integer: '5' })
    expect(refusals(big, { type: 'bigint' }, 'f')).toEqual([])
    expect(refusals(big, str, 'f')).toEqual(['f: 5n is no longer accepted (now string)'])
  })

  it('renders a nested union and a non-string literal in the message', () => {
    const arr: ValidatorJSON = { type: 'array', value: union(lit(1), lit(true)) }
    expect(refusals(arr, str, 'f')).toEqual(['f: 1 | true[] is no longer accepted (now string)'])
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

  it('records a first snapshot when none exists', () => {
    expect(verdict(null, prev, 10)).toEqual({ ok: true, write: true, message: 'no snapshot yet' })
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

describe('main', () => {
  const tree = fixtureTrees('client-contract')
  /** A Convex-registered function as the import sees it: public, with serialized args. */
  const fn = (args: ValidatorJSON, isPublic = true) =>
    `{ isPublic: ${isPublic}, exportArgs: () => ${JSON.stringify(JSON.stringify(args))} }`
  const deployment = (floor: number, gamesArgs: ValidatorJSON) =>
    tree({
      'apps/web/convex/_generated/api.d.ts': [
        'import type * as games from "../games.js";',
        'import type * as model_x from "../model/x.js";',
      ].join('\n'),
      'apps/web/convex/buildFloor.ts': `export const BUILD_FLOOR = ${floor}\n`,
      'apps/web/convex/games.ts': [
        `export const rename = ${fn(gamesArgs)}`,
        `export const sweep = ${fn(obj({}), false)}`,
        'export const helper = 3',
        'export const nothing = null',
      ].join('\n'),
      'apps/web/convex/model/x.ts': `export const read = ${fn(obj({ id: str }))}\n`,
    })
  const run = async (root: string, argv: string[] = []) => {
    const io = captured()
    const snapshotPath = join(root, 'snapshot.json')
    const code = await main(argv, { root, snapshotPath, functionFloor: 2, ...io })
    return { code, ...io, snapshotPath }
  }

  test('with no snapshot, refuses without --write and records one with it', async () => {
    const root = deployment(10, obj({ name: str }))
    const first = await run(root)
    expect(first.code).toBe(1)
    expect(first.err[0]).toContain('convex-client-contract.json is out of date (no snapshot yet)')
    expect(existsSync(first.snapshotPath)).toBe(false)

    const written = await run(root, ['--write'])
    expect(written).toMatchObject({ code: 0, err: [] })
    expect(written.out).toEqual([
      '✓ client contract: recorded 2 public functions (no snapshot yet)',
    ])
    expect(JSON.parse(readFileSync(written.snapshotPath, 'utf8'))).toEqual({
      floor: 10,
      functions: { 'games:rename': obj({ name: str }), 'model/x:read': obj({ id: str }) },
    })

    const again = await run(root)
    expect(again.out).toEqual([
      '✓ client contract: 2 public functions in 2 modules match the snapshot (floor 10)',
    ])
  })

  test('a breaking change under the same floor fails, naming the field', async () => {
    const root = deployment(10, obj({ name: str, by: str }))
    writeFileSync(
      join(root, 'snapshot.json'),
      JSON.stringify({
        floor: 10,
        functions: { 'games:rename': obj({ name: str }), 'model/x:read': obj({ id: str }) },
      })
    )
    const result = await run(root, ['--write'])
    expect(result.code).toBe(1)
    expect(result.err[0]).toContain(
      'games:rename.by: new required argument, which an older tab never sends'
    )
  })

  test('too few public functions trips the scan floor', async () => {
    const root = deployment(10, obj({}))
    const exit = spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit ${code}`)
    })
    const quiet = spyOn(console, 'error').mockImplementation(() => {})
    try {
      await expect(
        main([], { root, snapshotPath: join(root, 's.json'), functionFloor: 3, ...captured() })
      ).rejects.toThrow('exit 1')
      expect(String(quiet.mock.calls[0]?.[0])).toContain('scanned 2 files, expected at least 3')
    } finally {
      exit.mockRestore()
      quiet.mockRestore()
    }
  })
})
