/**
 * The fill-grid check (`_fillGrid.ts`, hard rule R68) on hand-made boxes: full
 * rows and a stretched last row pass; a centred, a left-packed or a
 * content-sized row fails, as do a hand-built grid's orphan cell and a
 * masonry's empty column.
 */
import { describe, expect, test } from 'bun:test'
import type { GridBoxes } from '../_fillGrid'
import { findFillGridFaults } from '../_fillGrid'

const LIST = { left: 0, right: 300, top: 0 }
const cell = (left: number, right: number, top: number) => ({ left, right, top })

const grid = (cells: GridBoxes['cells'], kind: GridBoxes['kind'] = 'fill'): GridBoxes[] => [
  { kind, label: 'Raider stats', list: LIST, cells },
]

const FULL = [cell(0, 90, 0), cell(105, 195, 0), cell(210, 300, 0)]

describe('the item grid fills its rows', () => {
  test('full rows and a last row stretched across the line pass', () => {
    // Three a row, seven items: the lone seventh takes the line.
    const cells = [
      ...FULL,
      cell(0, 90, 50),
      cell(105, 195, 50),
      cell(210, 300, 50),
      cell(0, 300, 100),
    ]
    expect(findFillGridFaults(grid(cells))).toEqual([])
  })

  test('two last-row items that share the line pass', () => {
    expect(findFillGridFaults(grid([...FULL, cell(0, 142.5, 50), cell(157.5, 300, 50)]))).toEqual(
      []
    )
  })

  test('a last row packed left fails, with what it leaves', () => {
    expect(findFillGridFaults(grid([...FULL, cell(0, 90, 50)]))).toEqual([
      'fill: Raider stats: row 2 of 2 (1 items) leaves 0px left, 210px right',
    ])
  })

  test('a centred row fails on both edges', () => {
    expect(findFillGridFaults(grid([cell(100, 200, 0)]))).toEqual([
      'fill: Raider stats: row 1 of 1 (1 items) leaves 100px left, 100px right',
    ])
  })

  test('a sub-pixel shortfall passes', () => {
    expect(findFillGridFaults(grid([cell(0.4, 299.5, 0)]))).toEqual([])
  })
})

describe('a hand-built grid of equal tracks', () => {
  test('a full last row passes; rows above it are not judged', () => {
    expect(
      findFillGridFaults(
        grid([...FULL, cell(0, 90, 50), cell(105, 195, 50), cell(210, 300, 50)], 'orphan')
      )
    ).toEqual([])
  })

  test('an orphan cell in its last row fails', () => {
    expect(findFillGridFaults(grid([...FULL, cell(0, 90, 50)], 'orphan'))).toEqual([
      'orphan: Raider stats: row 2 of 2 (1 items) leaves 0px left, 210px right',
    ])
  })

  test('an empty track beside a single row fails', () => {
    expect(findFillGridFaults(grid([cell(0, 90, 0), cell(105, 195, 0)], 'orphan'))).toEqual([
      'orphan: Raider stats: row 1 of 1 (2 items) leaves 0px left, 105px right',
    ])
  })
})

describe('a masonry', () => {
  const masonry = (cells: GridBoxes['cells']): GridBoxes[] => [
    { kind: 'column', label: 'Systems installed', list: LIST, cells, slack: 12 },
  ]

  test('a last column that is used passes, whatever the columns hold', () => {
    expect(
      findFillGridFaults(masonry([cell(0, 144, 0), cell(0, 144, 80), cell(156, 300, 0)]))
    ).toEqual([])
  })

  test('an empty column fails', () => {
    expect(findFillGridFaults(masonry([cell(0, 92, 0), cell(104, 196, 0)]))).toEqual([
      'column: Systems installed leaves 104px of columns empty',
    ])
  })

  test('nothing drawn is no fault', () => {
    expect(findFillGridFaults(masonry([]))).toEqual([])
  })
})
