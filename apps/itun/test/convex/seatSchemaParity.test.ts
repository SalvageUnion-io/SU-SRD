import { describe, expect, test } from 'bun:test'
import schema, { seatMount, seatRange } from '../../convex/schema'
import { RANGE_BANDS, SeatSchema } from '../../src/lib/schemas/seat'

/**
 * `convex/schema.ts` declares the `seats` columns as Convex validators, and
 * `src/lib/schemas/seat.ts` is their Zod source of truth (ADR-038). Nothing
 * compares a Convex union with a Zod enum automatically, so a band or mount
 * kind added to one side would silently fail to validate on the other. This is
 * that comparison.
 */

const sorted = (xs: readonly string[]) => [...xs].sort()

describe('seats: Convex validators mirror the Zod seat schema', () => {
  test('range bands', () => {
    const convex = seatRange.members.map((m) => m.value)
    expect(sorted(convex)).toEqual(sorted(RANGE_BANDS))
    expect(sorted(SeatSchema.shape.range.options)).toEqual(sorted(RANGE_BANDS))
  })

  test('mount kinds and their fields', () => {
    const convex = Object.fromEntries(
      seatMount.members.map((m) => [m.fields.kind.value, sorted(Object.keys(m.fields))])
    )
    const zod = Object.fromEntries(
      SeatSchema.shape.mount.options.map((o) => [o.shape.kind.value, sorted(Object.keys(o.shape))])
    )
    expect(convex).toEqual(zod)
  })

  test('the table has exactly the seat fields', () => {
    const fields = Object.keys(schema.tables.seats.validator.fields)
    expect(sorted(fields)).toEqual(sorted(Object.keys(SeatSchema.shape)))
  })
})
