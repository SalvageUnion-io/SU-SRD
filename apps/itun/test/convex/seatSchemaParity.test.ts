import { describe, expect, test } from 'bun:test'
import { CORE_ROLL_BANDS } from 'salvageunion-reference/rules'
import schema, { seatMount, seatRange, seatResolving, seatRollBand } from '../../convex/schema'
import { CORE_ROLL_BAND_NAMES, RANGE_BANDS, SeatSchema } from '../../src/lib/schemas/seat'

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

  test('the resolve in progress, and its roll bands', () => {
    const zod = SeatSchema.shape.resolving.unwrap()
    expect(sorted(Object.keys(seatResolving.fields))).toEqual(sorted(Object.keys(zod.shape)))

    const convexBands = seatRollBand.members.map((m) => m.value)
    expect(sorted(convexBands)).toEqual(sorted(CORE_ROLL_BAND_NAMES))
    // Both mirror the rules package's own list of bands.
    expect(sorted(CORE_ROLL_BAND_NAMES)).toEqual(sorted(Object.keys(CORE_ROLL_BANDS)))
    const roll = zod.shape.roll.unwrap()
    expect(sorted(roll.shape.band.options)).toEqual(sorted(CORE_ROLL_BAND_NAMES))
    expect(sorted(Object.keys(roll.shape))).toEqual(
      sorted(Object.keys(seatResolving.fields.roll.fields))
    )
  })

  test('the table has exactly the seat fields', () => {
    const fields = Object.keys(schema.tables.seats.validator.fields)
    expect(sorted(fields)).toEqual(sorted(Object.keys(SeatSchema.shape)))
  })
})
