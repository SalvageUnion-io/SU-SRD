import { describe, expect, test } from 'bun:test'
import { z } from 'salvageunion-reference/zod'
import { deepStrip } from '../deepStrip'

// A minimal strict object nested one level deep, mirroring the shape of
// e.g. CargoLotSchema / InjurySchema / EntityRefSchema in the app schemas.
const InnerSchema = z
  .object({
    id: z.string(),
    kind: z.enum(['a', 'b']),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.kind === 'b' && val.id === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'id required for kind b', path: ['id'] })
    }
  })

const OuterSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    inner: InnerSchema,
    innerList: z.array(InnerSchema),
    innerOptional: InnerSchema.optional(),
    innerNullable: InnerSchema.nullable(),
    innerMap: z.record(z.string(), InnerSchema),
    innerDefault: InnerSchema.default({ id: 'default-id', kind: 'a' }),
  })
  .strict()

describe('deepStrip', () => {
  test('does not mutate the original schema — original stays strict at every depth', () => {
    deepStrip(OuterSchema)

    const stillRejectsTopLevelUnknown = OuterSchema.safeParse({
      id: '1',
      name: 'x',
      inner: { id: 'a', kind: 'a' },
      innerList: [],
      innerNullable: null,
      innerMap: {},
      unexpectedTopLevel: true,
    })
    expect(stillRejectsTopLevelUnknown.success).toBe(false)

    const stillRejectsNestedUnknown = OuterSchema.safeParse({
      id: '1',
      name: 'x',
      inner: { id: 'a', kind: 'a', unexpectedNested: true },
      innerList: [],
      innerNullable: null,
      innerMap: {},
    })
    expect(stillRejectsNestedUnknown.success).toBe(false)
  })

  test('strips an unknown key on a directly-nested strict object', () => {
    const relaxed = deepStrip(OuterSchema)
    const result = relaxed.safeParse({
      id: '1',
      name: 'x',
      inner: { id: 'a', kind: 'a', driftedField: 'value-from-the-future' },
      innerList: [],
      innerNullable: null,
      innerMap: {},
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect('driftedField' in result.data.inner).toBe(false)
      expect(result.data.inner).toEqual({ id: 'a', kind: 'a' })
    }
  })

  test('strips an unknown key inside an array of nested strict objects', () => {
    const relaxed = deepStrip(OuterSchema)
    const result = relaxed.safeParse({
      id: '1',
      name: 'x',
      inner: { id: 'a', kind: 'a' },
      innerList: [{ id: 'l1', kind: 'b', extra: 1 }],
      innerNullable: null,
      innerMap: {},
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.innerList).toEqual([{ id: 'l1', kind: 'b' }])
    }
  })

  test('strips an unknown key inside an optional nested strict object', () => {
    const relaxed = deepStrip(OuterSchema)
    const result = relaxed.safeParse({
      id: '1',
      name: 'x',
      inner: { id: 'a', kind: 'a' },
      innerList: [],
      innerOptional: { id: 'o', kind: 'a', fromTheFuture: true },
      innerNullable: null,
      innerMap: {},
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.innerOptional).toEqual({ id: 'o', kind: 'a' })
    }
  })

  test('strips an unknown key inside a nullable nested strict object', () => {
    const relaxed = deepStrip(OuterSchema)
    const result = relaxed.safeParse({
      id: '1',
      name: 'x',
      inner: { id: 'a', kind: 'a' },
      innerList: [],
      innerNullable: { id: 'n', kind: 'a', fromTheFuture: true },
      innerMap: {},
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.innerNullable).toEqual({ id: 'n', kind: 'a' })
    }
  })

  test('strips an unknown key inside a record value that is a nested strict object', () => {
    const relaxed = deepStrip(OuterSchema)
    const result = relaxed.safeParse({
      id: '1',
      name: 'x',
      inner: { id: 'a', kind: 'a' },
      innerList: [],
      innerNullable: null,
      innerMap: { slot1: { id: 'm', kind: 'a', fromTheFuture: true } },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.innerMap.slot1).toEqual({ id: 'm', kind: 'a' })
    }
  })

  test('still strips an unknown key at the top level (outer object)', () => {
    const relaxed = deepStrip(OuterSchema)
    const result = relaxed.safeParse({
      id: '1',
      name: 'x',
      inner: { id: 'a', kind: 'a' },
      innerList: [],
      innerNullable: null,
      innerMap: {},
      topLevelDrift: 'x',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect('topLevelDrift' in result.data).toBe(false)
    }
  })

  test('preserves business-rule checks (superRefine) on the nested schema', () => {
    const relaxed = deepStrip(OuterSchema)
    // kind 'b' requires a non-empty id per InnerSchema's superRefine — this
    // is a genuine data-integrity rule, not an unknown-key issue, and must
    // still fail even through the relaxed salvage schema.
    const result = relaxed.safeParse({
      id: '1',
      name: 'x',
      inner: { id: '', kind: 'b' },
      innerList: [],
      innerNullable: null,
      innerMap: {},
    })
    expect(result.success).toBe(false)
  })

  test('a defaulted nested strict object still fills its default when absent', () => {
    const relaxed = deepStrip(OuterSchema)
    const result = relaxed.safeParse({
      id: '1',
      name: 'x',
      inner: { id: 'a', kind: 'a' },
      innerList: [],
      innerNullable: null,
      innerMap: {},
      // innerDefault omitted — should fill from InnerSchema.default(...).
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.innerDefault).toEqual({ id: 'default-id', kind: 'a' })
    }
  })

  test('strips an unknown key inside a provided value for a defaulted nested strict object', () => {
    const relaxed = deepStrip(OuterSchema)
    const result = relaxed.safeParse({
      id: '1',
      name: 'x',
      inner: { id: 'a', kind: 'a' },
      innerList: [],
      innerNullable: null,
      innerMap: {},
      innerDefault: { id: 'd', kind: 'a', fromTheFuture: true },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.innerDefault).toEqual({ id: 'd', kind: 'a' })
    }
  })
})
