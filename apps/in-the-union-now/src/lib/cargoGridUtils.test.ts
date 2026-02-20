import { describe, expect, test } from 'bun:test'
import {
  computeGridColumns,
  computeGridDisplayCells,
  computeShapeDimensions,
  packItems,
  buildOccupancyMap,
  computeCellBorders,
  findCenterCell,
  findDeleteCell,
  computeAllCells,
  getRemainingCapacity,
  formatScrapName,
} from './cargoGridUtils'
import type { CargoGridItem, ShapePlacement } from './cargoGridUtils'

/** Helper to create test CargoGridItems with defaults for required fields */
function testItem(overrides: {
  cargoId: string
  name: string
  cellCount: number
  techLevel?: number | string
}): CargoGridItem {
  return { headerBg: 'bg-su-orange', cargoType: 'entity', ...overrides }
}

/** Helper to create test ShapePlacements with defaults */
function testPlacement(overrides: {
  cargoId: string
  name: string
  cellCount: number
  cells: number[]
  centerCell: number
  deleteCell: number
  techLevel?: number | string
}): ShapePlacement {
  return { headerBg: 'bg-su-orange', cargoType: 'entity', ...overrides }
}

// --- computeGridColumns ---

describe('computeGridColumns', () => {
  test('returns 0 for 0 capacity', () => {
    expect(computeGridColumns(0)).toBe(0)
  })

  test('uses 3 columns for small capacities (1-12)', () => {
    expect(computeGridColumns(1)).toBe(3)
    expect(computeGridColumns(3)).toBe(3)
    expect(computeGridColumns(6)).toBe(3)
    expect(computeGridColumns(12)).toBe(3)
  })

  test('widens to 4 columns when 3 would exceed 4 rows', () => {
    expect(computeGridColumns(13)).toBe(4)
    expect(computeGridColumns(16)).toBe(4)
  })

  test('widens to 5 columns for larger capacities', () => {
    expect(computeGridColumns(17)).toBe(5)
    expect(computeGridColumns(20)).toBe(5)
  })

  test('caps at 6 for very large capacities', () => {
    expect(computeGridColumns(21)).toBe(6)
    expect(computeGridColumns(30)).toBe(6)
  })
})

describe('computeGridDisplayCells', () => {
  test('at least 2 rows x columns', () => {
    // 3 columns → minimum 6 cells even if capacity is only 3
    expect(computeGridDisplayCells(3, 3)).toBe(6)
    expect(computeGridDisplayCells(5, 3)).toBe(6)
  })

  test('returns capacity when already large enough', () => {
    expect(computeGridDisplayCells(12, 3)).toBe(12)
    expect(computeGridDisplayCells(10, 3)).toBe(10)
  })

  test('returns 0 for 0 capacity', () => {
    expect(computeGridDisplayCells(0, 0)).toBe(0)
  })
})

// --- computeShapeDimensions ---

describe('computeShapeDimensions', () => {
  test('1 cell = 1x1', () => {
    expect(computeShapeDimensions(1, 6)).toEqual([1, 1])
  })

  test('2 cells = 2x1 (wider than tall)', () => {
    expect(computeShapeDimensions(2, 6)).toEqual([2, 1])
  })

  test('3 cells = 2x2 bounding box', () => {
    expect(computeShapeDimensions(3, 6)).toEqual([2, 2])
  })

  test('4 cells = 2x2 perfect square', () => {
    expect(computeShapeDimensions(4, 6)).toEqual([2, 2])
  })

  test('5 cells = 3x2', () => {
    expect(computeShapeDimensions(5, 6)).toEqual([3, 2])
  })

  test('6 cells = 3x2', () => {
    expect(computeShapeDimensions(6, 6)).toEqual([3, 2])
  })

  test('7 cells = 3x3', () => {
    expect(computeShapeDimensions(7, 6)).toEqual([3, 3])
  })

  test('9 cells = 3x3', () => {
    expect(computeShapeDimensions(9, 6)).toEqual([3, 3])
  })

  test('respects maxCols constraint', () => {
    // 9 cells in 2-column grid: width capped at 2, height = 5
    expect(computeShapeDimensions(9, 2)).toEqual([2, 5])
  })

  test('0 cells = 0x0', () => {
    expect(computeShapeDimensions(0, 6)).toEqual([0, 0])
  })
})

// --- packItems ---

describe('packItems', () => {
  test('single 1-cell item', () => {
    const items = [testItem({ cargoId: 'a', name: 'A', cellCount: 1 })]
    const placements = packItems(items, 6, 6)

    expect(placements).toHaveLength(1)
    expect(placements[0]!.cells).toEqual([0])
    expect(placements[0]!.centerCell).toBe(0)
    expect(placements[0]!.deleteCell).toBe(0)
  })

  test('single 4-cell item packs as 2x2', () => {
    const items = [testItem({ cargoId: 'a', name: 'A', cellCount: 4 })]
    const placements = packItems(items, 12, 6)

    expect(placements).toHaveLength(1)
    expect(placements[0]!.cells).toHaveLength(4)
    // 2x2 at top-left: cells 0,1 (row 0), 6,7 (row 1)
    expect(placements[0]!.cells).toEqual([0, 1, 6, 7])
  })

  test('multiple items pack without overlap', () => {
    const items = [
      testItem({ cargoId: 'a', name: 'A', cellCount: 2 }),
      testItem({ cargoId: 'b', name: 'B', cellCount: 2 }),
    ]
    const placements = packItems(items, 12, 6)

    expect(placements).toHaveLength(2)
    const allCells = [...placements[0]!.cells, ...placements[1]!.cells]
    const uniqueCells = new Set(allCells)
    expect(uniqueCells.size).toBe(allCells.length) // no overlap
  })

  test('3-cell item in 6-col grid uses 2x2 bounding box with 3 cells', () => {
    const items = [testItem({ cargoId: 'a', name: 'A', cellCount: 3 })]
    const placements = packItems(items, 12, 6)

    expect(placements[0]!.cells).toHaveLength(3)
    // 2-wide shape: cells 0,1 (row 0), 6 (row 1)
    expect(placements[0]!.cells).toEqual([0, 1, 6])
  })

  test('items that exceed capacity are skipped', () => {
    const items = [testItem({ cargoId: 'a', name: 'A', cellCount: 10 })]
    const placements = packItems(items, 6, 6)

    // 10 cells can't fit in 6 capacity
    expect(placements).toHaveLength(0)
  })

  test('packs items in creation order around each other', () => {
    const items = [
      testItem({ cargoId: 'a', name: 'A', cellCount: 4 }), // 2x2
      testItem({ cargoId: 'b', name: 'B', cellCount: 1 }), // 1x1
    ]
    const placements = packItems(items, 12, 6)

    expect(placements).toHaveLength(2)
    // A occupies 0,1,6,7 — B should go to 2
    expect(placements[0]!.cells).toEqual([0, 1, 6, 7])
    expect(placements[1]!.cells).toEqual([2])
  })
})

// --- buildOccupancyMap ---

describe('buildOccupancyMap', () => {
  test('builds correct map from placements', () => {
    const placements = [
      testPlacement({
        cargoId: 'a',
        name: 'A',
        cellCount: 2,
        cells: [0, 1],
        centerCell: 0,
        deleteCell: 1,
      }),
    ]
    const map = buildOccupancyMap(placements, 6)

    expect(map).toEqual(['a', 'a', null, null, null, null])
  })

  test('ignores out-of-bounds cells', () => {
    const placements = [
      testPlacement({
        cargoId: 'a',
        name: 'A',
        cellCount: 1,
        cells: [10],
        centerCell: 10,
        deleteCell: 10,
      }),
    ]
    const map = buildOccupancyMap(placements, 6)

    expect(map).toEqual([null, null, null, null, null, null])
  })
})

// --- computeCellBorders ---

describe('computeCellBorders', () => {
  test('single-cell item has borders on all sides', () => {
    const map: (string | null)[] = ['a', null, null, null, null, null]
    const borders = computeCellBorders(0, map, 6)

    expect(borders).toEqual({ top: true, right: true, bottom: true, left: true })
  })

  test('empty cell has no borders', () => {
    const map: (string | null)[] = [null, null, null, null, null, null]
    const borders = computeCellBorders(0, map, 6)

    expect(borders).toEqual({ top: false, right: false, bottom: false, left: false })
  })

  test('two horizontal cells share no internal border', () => {
    // 6-col grid, cells 0 and 1 owned by 'a'
    const map: (string | null)[] = ['a', 'a', null, null, null, null]

    const left = computeCellBorders(0, map, 6)
    expect(left.right).toBe(false) // no border between 0 and 1

    const right = computeCellBorders(1, map, 6)
    expect(right.left).toBe(false) // no border between 1 and 0
  })

  test('two vertical cells share no internal border', () => {
    // 3-col grid: cells 0 (row 0) and 3 (row 1) owned by 'a'
    const map: (string | null)[] = ['a', null, null, 'a', null, null]

    const top = computeCellBorders(0, map, 3)
    expect(top.bottom).toBe(false)

    const bottom = computeCellBorders(3, map, 3)
    expect(bottom.top).toBe(false)
  })

  test('adjacent cells of different items have borders', () => {
    const map: (string | null)[] = ['a', 'b', null, null, null, null]

    const cell0 = computeCellBorders(0, map, 6)
    expect(cell0.right).toBe(true)

    const cell1 = computeCellBorders(1, map, 6)
    expect(cell1.left).toBe(true)
  })
})

// --- findCenterCell ---

describe('findCenterCell', () => {
  test('single cell returns itself', () => {
    expect(findCenterCell([5], 6)).toBe(5)
  })

  test('2x2 square returns geometric center', () => {
    // Cells 0,1,6,7 in 6-col grid
    // Center = (0.5, 0.5), nearest occupied is any of them
    const center = findCenterCell([0, 1, 6, 7], 6)
    expect([0, 1, 6, 7]).toContain(center)
  })

  test('L-shaped 3 cells snaps to occupied cell', () => {
    // Cells 0,1,6 in 6-col grid
    // Bounding box center: (0.5, 0.5), nearest occupied could be 0 or 1
    const center = findCenterCell([0, 1, 6], 6)
    expect([0, 1, 6]).toContain(center)
  })

  test('empty array returns 0', () => {
    expect(findCenterCell([], 6)).toBe(0)
  })
})

// --- findDeleteCell ---

describe('findDeleteCell', () => {
  test('single cell returns itself', () => {
    expect(findDeleteCell([5], 6)).toBe(5)
  })

  test('2x2 returns top-right cell', () => {
    // Cells 0,1,6,7 in 6-col grid. Top row = 0, cells on top row: 0 (col 0), 1 (col 1)
    expect(findDeleteCell([0, 1, 6, 7], 6)).toBe(1)
  })

  test('L-shaped returns top-right of top row', () => {
    // Cells 0,1,6 in 6-col grid. Top row cells: 0,1 → max col = 1
    expect(findDeleteCell([0, 1, 6], 6)).toBe(1)
  })

  test('vertical strip returns top cell', () => {
    // Cells 0,6,12 in 6-col grid. Top row = 0, only cell 0
    expect(findDeleteCell([0, 6, 12], 6)).toBe(0)
  })

  test('empty array returns 0', () => {
    expect(findDeleteCell([], 6)).toBe(0)
  })
})

// --- computeAllCells ---

describe('computeAllCells', () => {
  test('returns correct cell info for simple placement', () => {
    const placements = [
      testPlacement({
        cargoId: 'a',
        name: 'Test Item',
        cellCount: 1,
        cells: [0],
        centerCell: 0,
        deleteCell: 0,
        techLevel: 3,
      }),
    ]
    const map = buildOccupancyMap(placements, 4)
    const cells = computeAllCells(map, placements, 2)

    expect(cells).toHaveLength(4)
    // Cell 0 should be occupied with label and delete
    expect(cells[0]!.cargoId).toBe('a')
    expect(cells[0]!.showLabel).toBe(true)
    expect(cells[0]!.showDelete).toBe(true)
    expect(cells[0]!.label).toBe('Test Item')
    expect(cells[0]!.techLevel).toBe(3)

    // Cell 1 should be empty
    expect(cells[1]!.cargoId).toBeNull()
    expect(cells[1]!.showLabel).toBe(false)
  })

  test('multi-cell placement: only center shows label, only delete cell shows delete', () => {
    const placements = [
      testPlacement({
        cargoId: 'a',
        name: 'Big Item',
        cellCount: 4,
        cells: [0, 1, 6, 7],
        centerCell: 0,
        deleteCell: 1,
      }),
    ]
    const map = buildOccupancyMap(placements, 12)
    const cells = computeAllCells(map, placements, 6)

    // Cell 0 = center → showLabel, not delete
    expect(cells[0]!.showLabel).toBe(true)
    expect(cells[0]!.showDelete).toBe(false)

    // Cell 1 = delete → showDelete, not label
    expect(cells[1]!.showLabel).toBe(false)
    expect(cells[1]!.showDelete).toBe(true)

    // Cell 6 = occupied, neither
    expect(cells[6]!.cargoId).toBe('a')
    expect(cells[6]!.showLabel).toBe(false)
    expect(cells[6]!.showDelete).toBe(false)
  })
})

// --- getRemainingCapacity ---

describe('getRemainingCapacity', () => {
  test('full capacity when no items', () => {
    expect(getRemainingCapacity([], 10)).toBe(10)
  })

  test('subtracts item cell counts', () => {
    const items = [
      testItem({ cargoId: 'a', name: 'A', cellCount: 3 }),
      testItem({ cargoId: 'b', name: 'B', cellCount: 2 }),
    ]
    expect(getRemainingCapacity(items, 10)).toBe(5)
  })

  test('floors at 0', () => {
    const items = [testItem({ cargoId: 'a', name: 'A', cellCount: 15 })]
    expect(getRemainingCapacity(items, 10)).toBe(0)
  })
})

// --- formatScrapName ---

describe('formatScrapName', () => {
  test('formats with numeric tech level', () => {
    expect(formatScrapName(3, 4)).toBe('3TL4 Scrap')
  })

  test('formats with string tech level', () => {
    expect(formatScrapName(1, 'B')).toBe('1TLB Scrap')
  })
})
