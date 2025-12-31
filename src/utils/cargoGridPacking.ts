/**
 * Cargo Grid Packing Utilities
 *
 * Handles the complex logic of packing cargo items into a grid where each item
 * occupies a connected region of cells, creating a "single box" visual appearance.
 */

import { getCargoGridConfig } from '../constants/gameRules'
import { logger } from '../lib/logger'

export interface GridCell {
  itemId: string | null
  isCenter: boolean
  isTopRight: boolean
}

export interface PackedGrid {
  cells: GridCell[]
  rows: number
  cols: number
}

interface Position {
  row: number
  col: number
}

/**
 * Find the best rectangular shape for a given amount
 * Prefers square-ish shapes (minimizes perimeter)
 */
function findBestShape(amount: number, maxCols: number): { width: number; height: number } {
  const factors: Array<{ width: number; height: number; perimeter: number }> = []

  for (let width = 1; width <= Math.min(amount, maxCols); width++) {
    if (amount % width === 0) {
      const height = amount / width
      factors.push({ width, height, perimeter: 2 * (width + height) })
    }
  }

  if (factors.length === 0) {
    const sqrt = Math.sqrt(amount)
    const width = Math.min(Math.ceil(sqrt), maxCols)
    const height = Math.ceil(amount / width)
    return { width, height }
  }

  factors.sort((a, b) => a.perimeter - b.perimeter)
  const firstFactor = factors[0]
  if (!firstFactor) {
    return { width: 1, height: amount }
  }
  return { width: firstFactor.width, height: firstFactor.height }
}

/**
 * Convert 1D index to 2D position
 */
function indexToPos(index: number, cols: number): Position {
  return {
    row: Math.floor(index / cols),
    col: index % cols,
  }
}

/**
 * Convert 2D position to 1D index
 */
function posToIndex(pos: Position, cols: number): number {
  return pos.row * cols + pos.col
}

/**
 * Get neighbors of a cell (up, down, left, right)
 */
function getNeighbors(pos: Position, rows: number, cols: number): Position[] {
  const neighbors: Position[] = []

  if (pos.row > 0) neighbors.push({ row: pos.row - 1, col: pos.col })
  if (pos.row < rows - 1) neighbors.push({ row: pos.row + 1, col: pos.col })
  if (pos.col > 0) neighbors.push({ row: pos.row, col: pos.col - 1 })
  if (pos.col < cols - 1) neighbors.push({ row: pos.row, col: pos.col + 1 })

  return neighbors
}

/**
 * Find a connected region of empty cells using flood fill
 * Returns null if no region of the required size exists
 */
function findConnectedRegion(
  cells: GridCell[],
  rows: number,
  cols: number,
  targetSize: number,
  preferredShape?: { width: number; height: number }
): number[] | null {
  const visited = new Set<number>()

  if (preferredShape) {
    const region = findRectangularRegion(
      cells,
      rows,
      cols,
      preferredShape.width,
      preferredShape.height
    )
    if (region) return region
  }

  for (let startIdx = 0; startIdx < cells.length; startIdx++) {
    const startCell = cells[startIdx]
    if (!startCell || startCell.itemId !== null || visited.has(startIdx)) continue

    const region: number[] = []
    const queue: number[] = [startIdx]
    const regionVisited = new Set<number>()

    while (queue.length > 0 && region.length < targetSize) {
      const idx = queue.shift()!
      if (regionVisited.has(idx)) continue

      regionVisited.add(idx)
      visited.add(idx)

      const cell = cells[idx]
      if (cell && cell.itemId === null) {
        region.push(idx)

        const pos = indexToPos(idx, cols)
        const neighbors = getNeighbors(pos, rows, cols)

        for (const neighborPos of neighbors) {
          const neighborIdx = posToIndex(neighborPos, cols)
          const neighborCell = cells[neighborIdx]
          if (!regionVisited.has(neighborIdx) && neighborCell?.itemId === null) {
            queue.push(neighborIdx)
          }
        }
      }
    }

    if (region.length >= targetSize) {
      return region.slice(0, targetSize)
    }
  }

  return null
}

/**
 * Try to find a rectangular region of the specified dimensions
 */
function findRectangularRegion(
  cells: GridCell[],
  rows: number,
  cols: number,
  width: number,
  height: number
): number[] | null {
  for (let startRow = 0; startRow <= rows - height; startRow++) {
    for (let startCol = 0; startCol <= cols - width; startCol++) {
      const region: number[] = []
      let valid = true

      for (let r = startRow; r < startRow + height && valid; r++) {
        for (let c = startCol; c < startCol + width && valid; c++) {
          const idx = posToIndex({ row: r, col: c }, cols)
          const cell = cells[idx]
          if (!cell || cell.itemId !== null) {
            valid = false
          } else {
            region.push(idx)
          }
        }
      }

      if (valid && region.length === width * height) {
        return region
      }
    }
  }

  return null
}

/**
 * Find a connected region that includes a specific cell
 * Returns null if no region of the required size exists that includes the target cell
 */
function findConnectedRegionIncludingCell(
  cells: GridCell[],
  rows: number,
  cols: number,
  targetSize: number,
  targetCell: { row: number; col: number },
  preferredShape?: { width: number; height: number }
): number[] | null {
  const targetIdx = posToIndex(targetCell, cols)

  const targetCellData = cells[targetIdx]
  if (
    targetIdx < 0 ||
    targetIdx >= cells.length ||
    !targetCellData ||
    targetCellData.itemId !== null
  ) {
    return null
  }

  if (preferredShape) {
    const { width, height } = preferredShape
    for (let offsetRow = 0; offsetRow < height; offsetRow++) {
      for (let offsetCol = 0; offsetCol < width; offsetCol++) {
        const startRow = targetCell.row - offsetRow
        const startCol = targetCell.col - offsetCol

        if (
          startRow >= 0 &&
          startCol >= 0 &&
          startRow + height <= rows &&
          startCol + width <= cols
        ) {
          const region: number[] = []
          let valid = true

          for (let r = startRow; r < startRow + height && valid; r++) {
            for (let c = startCol; c < startCol + width && valid; c++) {
              const idx = posToIndex({ row: r, col: c }, cols)
              const cell = cells[idx]
              if (!cell || cell.itemId !== null) {
                valid = false
              } else {
                region.push(idx)
              }
            }
          }

          if (valid && region.length === width * height && region.includes(targetIdx)) {
            return region
          }
        }
      }
    }
  }

  const region: number[] = []
  const queue: number[] = [targetIdx]
  const visited = new Set<number>()

  while (queue.length > 0 && region.length < targetSize) {
    const idx = queue.shift()!
    if (visited.has(idx)) continue

    visited.add(idx)

    const cell = cells[idx]
    if (cell && cell.itemId === null) {
      region.push(idx)

      const pos = indexToPos(idx, cols)
      const neighbors = getNeighbors(pos, rows, cols)

      for (const neighborPos of neighbors) {
        const neighborIdx = posToIndex(neighborPos, cols)
        const neighborCell = cells[neighborIdx]
        if (!visited.has(neighborIdx) && neighborCell?.itemId === null) {
          queue.push(neighborIdx)
        }
      }
    }
  }

  if (region.length >= targetSize) {
    return region.slice(0, targetSize)
  }

  return null
}

/**
 * Find the center-most and top-right-most cells in a region
 */
function findSpecialCells(
  region: number[],
  cols: number
): { centerIdx: number; topRightIdx: number } {
  const positions = region.map((idx) => indexToPos(idx, cols))

  const avgRow = positions.reduce((sum, p) => sum + p.row, 0) / positions.length
  const avgCol = positions.reduce((sum, p) => sum + p.col, 0) / positions.length

  const firstIdx = region[0]
  if (firstIdx === undefined) {
    throw new Error('Region cannot be empty')
  }

  let centerIdx = firstIdx
  let minDist = Infinity

  for (const idx of region) {
    const pos = indexToPos(idx, cols)
    const dist = Math.sqrt((pos.row - avgRow) ** 2 + (pos.col - avgCol) ** 2)
    if (dist < minDist) {
      minDist = dist
      centerIdx = idx
    }
  }

  let topRightIdx = firstIdx
  let minRow = Infinity
  let maxCol = -Infinity

  for (const idx of region) {
    const pos = indexToPos(idx, cols)
    if (pos.row < minRow || (pos.row === minRow && pos.col > maxCol)) {
      minRow = pos.row
      maxCol = pos.col
      topRightIdx = idx
    }
  }

  return { centerIdx, topRightIdx }
}

/**
 * Pack cargo items into a grid, preserving existing placements when possible
 * If an item has a position, the packing algorithm will try to include that cell in the item's region
 */
export function packCargoGrid(
  items: Array<{ id: string; amount: number; position?: { row: number; col: number } }>,
  maxCapacity: number,
  previousGrid?: PackedGrid
): PackedGrid {
  const { cols } = getCargoGridConfig(maxCapacity)
  const rows = Math.ceil(maxCapacity / cols)

  const cells: GridCell[] = Array(maxCapacity)
    .fill(null)
    .map(() => ({
      itemId: null,
      isCenter: false,
      isTopRight: false,
    }))

  if (previousGrid) {
    const itemIds = new Set(items.map((item) => item.id))

    for (let i = 0; i < Math.min(previousGrid.cells.length, cells.length); i++) {
      const prevCell = previousGrid.cells[i]
      if (prevCell?.itemId && itemIds.has(prevCell.itemId)) {
        cells[i] = { ...prevCell }
      }
    }
  }

  const placedItemIds = new Set(
    cells
      .filter((cell) => cell?.itemId !== null && cell.itemId !== undefined)
      .map((cell) => cell.itemId!)
  )
  const itemsToPlace = items.filter((item) => !placedItemIds.has(item.id))

  let needsRepack = false
  for (const item of itemsToPlace) {
    const preferredShape = findBestShape(item.amount, cols)

    let region: number[] | null = null
    if (item.position) {
      region = findConnectedRegionIncludingCell(
        cells,
        rows,
        cols,
        item.amount,
        item.position,
        preferredShape
      )
    }

    if (!region) {
      region = findConnectedRegion(cells, rows, cols, item.amount, preferredShape)
    }

    if (!region) {
      needsRepack = true
      break
    }

    const { centerIdx, topRightIdx } = findSpecialCells(region, cols)

    for (const idx of region) {
      const cell = cells[idx]
      if (cell) {
        cell.itemId = item.id
        cell.isCenter = idx === centerIdx
        cell.isTopRight = idx === topRightIdx
      }
    }
  }

  if (needsRepack) {
    for (let i = 0; i < cells.length; i++) {
      cells[i] = {
        itemId: null,
        isCenter: false,
        isTopRight: false,
      }
    }

    const sortedItems = [...items]
      .map((item) => ({ ...item, position: undefined }))
      .sort((a, b) => b.amount - a.amount)

    for (const item of sortedItems) {
      const preferredShape = findBestShape(item.amount, cols)

      const region = findConnectedRegion(cells, rows, cols, item.amount, preferredShape)

      if (!region) {
        logger.warn(`Could not fit item ${item.id} with amount ${item.amount}`)
        continue
      }

      const { centerIdx, topRightIdx } = findSpecialCells(region, cols)

      for (const idx of region) {
        const cell = cells[idx]
        if (cell) {
          cell.itemId = item.id
          cell.isCenter = idx === centerIdx
          cell.isTopRight = idx === topRightIdx
        }
      }
    }
  }

  return { cells, rows, cols }
}
