import { describe, expect, test } from 'bun:test'
import { CORE_ROLL_BANDS } from 'salvageunion-reference/rules'
import { CORE_ROLL_BAND_NAMES } from '../seat'

describe('seat roll bands', () => {
  test('are the Core Mechanic bands the rules package names', () => {
    // `convex/schema.ts` builds its roll-band union from this list, so this is
    // the one place it can part from the rules.
    const names: string[] = [...CORE_ROLL_BAND_NAMES]
    expect(names.sort()).toEqual(Object.keys(CORE_ROLL_BANDS).sort())
  })
})
