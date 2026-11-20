/**
 * The cut-out law's render check (`_cutouts.ts`) on hand-made readings: a
 * cut-out on its strip's foot passes; one floated off it fails, with the fix.
 */
import { describe, expect, test } from 'bun:test'
import type { CutoutRead } from '../_cutouts'
import { CUTOUT_FIX, findCutoutFaults } from '../_cutouts'

const read = (off: number): CutoutRead => ({ what: 'ledger col', label: 'Slots', off })

describe('the cut-out law at render', () => {
  test('a cut-out on its foot passes, sub-pixel rounding with it', () => {
    expect(findCutoutFaults([read(0), read(0.6), read(-1)])).toEqual([])
  })

  test('a cut-out floated off its foot fails, naming it and printing the fix', () => {
    expect(findCutoutFaults([read(3)])).toEqual([
      `foot: ledger col "Slots" 3.0px off its strip's foot (${CUTOUT_FIX})`,
    ])
  })

  test('one hanging below its foot fails too', () => {
    expect(findCutoutFaults([read(-2.2)])).toHaveLength(1)
  })
})
