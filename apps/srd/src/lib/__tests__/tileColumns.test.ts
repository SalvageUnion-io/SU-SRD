/**
 * A Catalog group's columns: the fewest lines it needs at a width, its tiles
 * shared evenly across them, so no tile is stranded on a last line.
 */
import { describe, expect, test } from 'bun:test'
import { balancedColumns, tileColumnStyle } from '../tileColumns'

describe('balancedColumns', () => {
  test('a size with a divisor that fits fills every line', () => {
    // The six base classes at five across were 5 + 1; chassis TL1's eight 5 + 3.
    expect(balancedColumns(6, 5)).toBe(3)
    expect(balancedColumns(8, 5)).toBe(4)
    expect(balancedColumns(12, 5)).toBe(4)
    expect(balancedColumns(10, 5)).toBe(5)
  })

  test('any other size falls short by the least it can, in no more lines', () => {
    expect(balancedColumns(7, 5)).toBe(4)
    expect(balancedColumns(9, 5)).toBe(5)
    expect(balancedColumns(11, 5)).toBe(4)
  })

  test('a group one line holds keeps the grid’s columns', () => {
    expect(balancedColumns(5, 5)).toBe(5)
    expect(balancedColumns(3, 5)).toBe(5)
    expect(balancedColumns(1, 6)).toBe(6)
  })
})

describe('tileColumnStyle', () => {
  test('sets the columns at every step the grid fits, two to six', () => {
    expect(tileColumnStyle(6)).toEqual({
      '--srd-tiles-2': 2,
      '--srd-tiles-3': 3,
      '--srd-tiles-4': 3,
      '--srd-tiles-5': 3,
      '--srd-tiles-6': 6,
    })
  })
})
