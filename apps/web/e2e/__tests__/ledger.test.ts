/**
 * The Ledger's render check (`_ledger.ts`, hard rule R63) on hand-made
 * readings: a well-formed Ledger passes; each rule fails on its own fault.
 */
import { describe, expect, test } from 'bun:test'
import type { LedgerRead } from '../_ledger'
import { findLedgerFaults } from '../_ledger'

const GOOD: LedgerRead = {
  label: 'Systems',
  title: 'Systems',
  stamps: ['Slots', 'SV', 'Action', 'RNG', 'DMG', 'Traits', 'Cost'],
  sorts: false,
  underSlab: false,
  framedRows: 0,
  blankCells: 0,
  unpicked: 0,
}

const faults = (read: Partial<LedgerRead>, index = false) =>
  findLedgerFaults([{ ...GOOD, ...read }], { index })

describe('the Ledger at render', () => {
  test('a well-formed Ledger passes', () => {
    expect(faults({})).toEqual([])
  })

  test('frame: a row that frames itself', () => {
    expect(faults({ framedRows: 2 })).toEqual(['frame: Systems: 2 framed row(s)'])
  })

  test('tab: no title, or a Slab over the tab', () => {
    expect(faults({ title: '' })).toEqual(['tab: Systems: no title on its tab'])
    expect(faults({ underSlab: true })).toEqual(['tab: Systems: a Slab stands over its tab'])
  })

  test('order: a column out of the stat order', () => {
    expect(faults({ stamps: ['Slots', 'Cost', 'RNG', 'DMG'] })).toEqual([
      'order: Systems: RNG after Cost',
      'order: Systems: DMG after Cost',
    ])
  })

  test('empty: a blank cell', () => {
    expect(faults({ blankCells: 3 })).toEqual(['empty: Systems: 3 blank cell(s)'])
  })

  test('picked: a picked row that is not inked', () => {
    expect(faults({ unpicked: 1 })).toEqual(['picked: Systems: 1 picked row(s) not inked'])
  })

  test('sort: a head stamp sorts only on an SRD index', () => {
    expect(faults({ sorts: true })).toEqual(['sort: Systems: a head stamp sorts off an SRD index'])
    expect(faults({ sorts: true }, true)).toEqual([])
  })
})
