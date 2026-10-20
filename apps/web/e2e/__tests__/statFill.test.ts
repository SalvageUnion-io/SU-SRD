/**
 * The stat-grid fill check (`_statFill.ts`, ruleset "The source" 3) on hand-made boxes:
 * full rows and a stretched last row pass; a centred, a left-packed or a
 * content-sized row fails.
 */
import { describe, expect, test } from 'bun:test'
import type { StatColumnBoxes } from '../_statFill'
import { findStatFillFaults } from '../_statFill'

const LIST = { left: 0, right: 300, top: 0 }
const cell = (left: number, right: number, top: number) => ({ left, right, top })

const grid = (cells: StatColumnBoxes['cells']): StatColumnBoxes[] => [
  { label: 'Raider stats', list: LIST, cells },
]

describe('stat-grid fill', () => {
  test('full rows and a last row stretched across the line pass', () => {
    // Three a row, seven stats: the lone seventh spans the line.
    const cells = [
      cell(0, 90, 0),
      cell(105, 195, 0),
      cell(210, 300, 0),
      cell(0, 90, 50),
      cell(105, 195, 50),
      cell(210, 300, 50),
      cell(0, 300, 100),
    ]
    expect(findStatFillFaults(grid(cells))).toEqual([])
  })

  test('two last-row cells that share the line pass', () => {
    const cells = [
      cell(0, 90, 0),
      cell(105, 195, 0),
      cell(210, 300, 0),
      cell(0, 142.5, 50),
      cell(157.5, 300, 50),
    ]
    expect(findStatFillFaults(grid(cells))).toEqual([])
  })

  test('a centred last row leaves both edges', () => {
    const cells = [cell(0, 140, 0), cell(160, 300, 0), cell(80, 220, 50)]
    expect(findStatFillFaults(grid(cells))).toEqual([
      'Raider stats: row 2 of 2 (1 cells) leaves 80px left, 80px right',
    ])
  })

  test('a last row packed left leaves an empty cell', () => {
    const cells = [cell(0, 90, 0), cell(105, 195, 0), cell(210, 300, 0), cell(0, 90, 50)]
    expect(findStatFillFaults(grid(cells))).toEqual([
      'Raider stats: row 2 of 2 (1 cells) leaves 0px left, 210px right',
    ])
  })

  test('Stats sized to their labels leave a ragged edge on every row', () => {
    const cells = [cell(0, 110, 0), cell(160, 260, 0), cell(0, 120, 50), cell(160, 250, 50)]
    expect(findStatFillFaults(grid(cells))).toHaveLength(2)
  })
})
