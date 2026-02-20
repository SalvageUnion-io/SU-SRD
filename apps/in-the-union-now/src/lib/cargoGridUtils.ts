import type { EntitySchemaName, SURefEnumSchemaName } from 'salvageunion-reference'
import { SalvageUnionReference, getSalvageValue, getTechLevelNumber } from 'salvageunion-reference'
import { calculateBackgroundColor, techLevelColors } from 'suref-react'
import type { CargoRow } from '../types/common'

// --- Types ---

export type CargoType = 'entity' | 'custom' | 'scrap'

export type CargoGridItem = {
  cargoId: string
  name: string
  cellCount: number
  techLevel?: number | string
  headerBg: string
  cargoType: CargoType
  schemaName?: string
  schemaRefId?: string
}

export type ShapePlacement = {
  cargoId: string
  name: string
  cellCount: number
  cells: number[] // linear indices of ALL occupied cells
  centerCell: number // linear index for label
  deleteCell: number // linear index for X button
  techLevel?: number | string
  headerBg: string
  cargoType: CargoType
  schemaName?: string
  schemaRefId?: string
}

export type CellRenderInfo = {
  index: number
  cargoId: string | null
  borders: { top: boolean; right: boolean; bottom: boolean; left: boolean }
  showLabel: boolean
  showDelete: boolean
  label?: string
  techLevel?: number | string
  headerBg?: string
  cargoType?: CargoType
  schemaName?: string
  schemaRefId?: string
}

// --- Grid Geometry ---

/** Minimum grid display: 2 rows x 3 columns = 6 cells */
const MIN_GRID_COLUMNS = 3
const MAX_GRID_COLUMNS = 6
const MIN_GRID_ROWS = 2

/**
 * Computes the number of columns for the cargo grid.
 * Always 3 columns as the base. Goes wider (4-6) only when capacity
 * is large enough that 3 columns would create more than 4 rows.
 *
 * Capacity → Columns:
 *   0       → 0
 *   1-12    → 3
 *   13-16   → 4
 *   17-20   → 5
 *   21+     → 6
 */
export function computeGridColumns(capacity: number): number {
  if (capacity <= 0) return 0
  // Start at 3 columns, widen when rows exceed 4
  const maxRows = 4
  for (let cols = MIN_GRID_COLUMNS; cols < MAX_GRID_COLUMNS; cols++) {
    if (Math.ceil(capacity / cols) <= maxRows) return cols
  }
  return MAX_GRID_COLUMNS
}

/**
 * Returns the number of cells to display in the grid.
 * At least MIN_GRID_ROWS * columns cells so the grid always
 * has a visual minimum of 2 rows x 3 columns.
 */
export function computeGridDisplayCells(capacity: number, columns: number): number {
  if (capacity <= 0) return 0
  const minCells = MIN_GRID_ROWS * columns
  return Math.max(capacity, minCells)
}

/**
 * Derives cell count from a cargo row.
 * - Reference entities: uses getSalvageValue() lookup
 * - Custom items: metadata.salvage_value
 * - Scrap: cargo.amount (quantity)
 */
export function getCellCount(cargo: CargoRow): number {
  // Scrap: no schema_ref_id, amount IS the cell count
  if (!cargo.schema_ref_id) {
    const metadata = cargo.metadata as Record<string, unknown> | null
    // Custom item with explicit salvage_value
    if (metadata?.salvage_value !== undefined) {
      return Math.max(1, Number(metadata.salvage_value))
    }
    // Scrap or simple custom — use amount
    return Math.max(1, cargo.amount)
  }

  // Reference entity — look up SV
  const entity = SalvageUnionReference.get(
    cargo.schema_name as EntitySchemaName,
    cargo.schema_ref_id
  )
  if (entity) {
    const sv = getSalvageValue(entity)
    if (sv !== undefined) return Math.max(1, sv)
  }

  return 1
}

/**
 * Most square-like rectangle for cellCount cells.
 * width = min(ceil(sqrt(cellCount)), maxCols)
 * height = ceil(cellCount / width)
 */
export function computeShapeDimensions(
  cellCount: number,
  maxCols: number
): [width: number, height: number] {
  if (cellCount <= 0) return [0, 0]
  const w = Math.min(Math.ceil(Math.sqrt(cellCount)), maxCols)
  const h = Math.ceil(cellCount / w)
  return [w, h]
}

// --- Packing ---

/**
 * 2D rectangular bin-packing. Places items as compact rectangles on a grid.
 * Returns ShapePlacement[] with all occupied cell indices.
 */
export function packItems(
  items: CargoGridItem[],
  capacity: number,
  columns: number
): ShapePlacement[] {
  const rows = Math.ceil(capacity / columns)
  // Availability grid: true = free
  const grid: boolean[][] = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => true)
  )

  const placements: ShapePlacement[] = []

  for (const item of items) {
    if (item.cellCount <= 0) continue

    const cells = tryPlaceItem(item.cellCount, grid, rows, columns)
    if (!cells || cells.length === 0) continue

    // Mark cells as occupied
    for (const idx of cells) {
      const r = Math.floor(idx / columns)
      const c = idx % columns
      if (r < rows && c < columns) grid[r]![c] = false
    }

    const centerCell = findCenterCell(cells, columns)
    const deleteCell = findDeleteCell(cells, columns)

    placements.push({
      cargoId: item.cargoId,
      name: item.name,
      cellCount: item.cellCount,
      cells,
      centerCell,
      deleteCell,
      techLevel: item.techLevel,
      headerBg: item.headerBg,
      cargoType: item.cargoType,
      schemaName: item.schemaName,
      schemaRefId: item.schemaRefId,
    })
  }

  return placements
}

function tryPlaceItem(
  cellCount: number,
  grid: boolean[][],
  rows: number,
  columns: number
): number[] | null {
  const [w, h] = computeShapeDimensions(cellCount, columns)

  // Try normal orientation
  const cells = tryPlaceRect(w, h, cellCount, grid, rows, columns)
  if (cells) return cells

  // Try rotated if dimensions differ
  if (w !== h) {
    const rotated = tryPlaceRect(h, w, cellCount, grid, rows, columns)
    if (rotated) return rotated
  }

  // Fallback: linear packing into next available free cells
  return linearFallback(cellCount, grid, rows, columns)
}

function tryPlaceRect(
  w: number,
  h: number,
  cellCount: number,
  grid: boolean[][],
  rows: number,
  columns: number
): number[] | null {
  for (let r = 0; r <= rows - h; r++) {
    for (let c = 0; c <= columns - w; c++) {
      const cells: number[] = []
      let fits = true

      // Fill cells in reading order within the w*h bounding box
      outer: for (let dr = 0; dr < h; dr++) {
        for (let dc = 0; dc < w; dc++) {
          if (cells.length >= cellCount) break outer
          if (!grid[r + dr]![c + dc]) {
            fits = false
            break outer
          }
          cells.push((r + dr) * columns + (c + dc))
        }
      }

      if (fits && cells.length === cellCount) return cells
    }
  }
  return null
}

function linearFallback(
  cellCount: number,
  grid: boolean[][],
  rows: number,
  columns: number
): number[] | null {
  const cells: number[] = []
  for (let r = 0; r < rows && cells.length < cellCount; r++) {
    for (let c = 0; c < columns && cells.length < cellCount; c++) {
      if (grid[r]![c]) cells.push(r * columns + c)
    }
  }
  return cells.length === cellCount ? cells : null
}

// --- Occupancy ---

export function buildOccupancyMap(
  placements: ShapePlacement[],
  capacity: number
): (string | null)[] {
  const map: (string | null)[] = Array.from({ length: capacity }, () => null)
  for (const p of placements) {
    for (const idx of p.cells) {
      if (idx < capacity) map[idx] = p.cargoId
    }
  }
  return map
}

// --- Border Computation ---

export function computeCellBorders(
  index: number,
  occupancyMap: (string | null)[],
  columns: number
): { top: boolean; right: boolean; bottom: boolean; left: boolean } {
  const totalCells = occupancyMap.length
  const rows = Math.ceil(totalCells / columns)
  const r = Math.floor(index / columns)
  const c = index % columns
  const owner = occupancyMap[index]

  if (!owner) {
    return { top: false, right: false, bottom: false, left: false }
  }

  // Border exists if neighbor is different owner, empty, or out-of-bounds
  const top = r === 0 || occupancyMap[(r - 1) * columns + c] !== owner
  const bottom = r >= rows - 1 || occupancyMap[(r + 1) * columns + c] !== owner
  const left = c === 0 || occupancyMap[r * columns + (c - 1)] !== owner
  const right = c >= columns - 1 || occupancyMap[r * columns + (c + 1)] !== owner

  return { top, right, bottom, left }
}

// --- Center & Delete Cell ---

/**
 * Geometric center of the shape's bounding box, snapped to nearest occupied cell.
 */
export function findCenterCell(cells: number[], columns: number): number {
  if (cells.length === 0) return 0
  if (cells.length === 1) return cells[0]!

  let minRow = Infinity,
    maxRow = -Infinity,
    minCol = Infinity,
    maxCol = -Infinity

  for (const idx of cells) {
    const r = Math.floor(idx / columns)
    const c = idx % columns
    if (r < minRow) minRow = r
    if (r > maxRow) maxRow = r
    if (c < minCol) minCol = c
    if (c > maxCol) maxCol = c
  }

  const centerRow = (minRow + maxRow) / 2
  const centerCol = (minCol + maxCol) / 2

  // Snap to nearest actual cell
  let bestCell = cells[0]!
  let bestDist = Infinity

  for (const idx of cells) {
    const r = Math.floor(idx / columns)
    const c = idx % columns
    const dist = (r - centerRow) ** 2 + (c - centerCol) ** 2
    if (dist < bestDist) {
      bestDist = dist
      bestCell = idx
    }
  }

  return bestCell
}

/**
 * Top-right cell: among all cells on the minimum row, pick the one with max column.
 */
export function findDeleteCell(cells: number[], columns: number): number {
  if (cells.length === 0) return 0
  if (cells.length === 1) return cells[0]!

  let minRow = Infinity
  for (const idx of cells) {
    const r = Math.floor(idx / columns)
    if (r < minRow) minRow = r
  }

  let bestCell = cells[0]!
  let bestCol = -1

  for (const idx of cells) {
    const r = Math.floor(idx / columns)
    if (r === minRow) {
      const c = idx % columns
      if (c > bestCol) {
        bestCol = c
        bestCell = idx
      }
    }
  }

  return bestCell
}

// --- Master Cell Computation ---

export function computeAllCells(
  occupancyMap: (string | null)[],
  placements: ShapePlacement[],
  columns: number
): CellRenderInfo[] {
  // Build lookup for placement info
  const placementByCargoId = new Map<string, ShapePlacement>()
  for (const p of placements) {
    placementByCargoId.set(p.cargoId, p)
  }

  return occupancyMap.map((cargoId, index) => {
    const borders = computeCellBorders(index, occupancyMap, columns)
    const placement = cargoId ? placementByCargoId.get(cargoId) : undefined

    return {
      index,
      cargoId,
      borders,
      showLabel: placement ? placement.centerCell === index : false,
      showDelete: placement ? placement.deleteCell === index : false,
      label: placement?.name,
      techLevel: placement?.techLevel,
      headerBg: placement?.headerBg,
      cargoType: placement?.cargoType,
      schemaName: placement?.schemaName,
      schemaRefId: placement?.schemaRefId,
    }
  })
}

// --- Helpers ---

export function getRemainingCapacity(cargoItems: CargoGridItem[], capacity: number): number {
  const used = cargoItems.reduce((sum, item) => sum + item.cellCount, 0)
  return Math.max(0, capacity - used)
}

export function formatScrapName(quantity: number, techLevel: number | string): string {
  return `${quantity}TL${techLevel} Scrap`
}

/**
 * Compute Tailwind header bg class for a cargo item, matching entity display colors.
 */
function computeHeaderBg(
  schemaName: string | null,
  entity: { schemaName?: string; techLevel?: unknown } | undefined,
  techLevel: number | string | undefined
): string {
  // Reference entity — use the same logic as ReferenceEntityDisplay
  if (entity && schemaName) {
    const tlNum = getTechLevelNumber(entity as Parameters<typeof getTechLevelNumber>[0])
    return calculateBackgroundColor(
      schemaName as SURefEnumSchemaName,
      '',
      tlNum,
      entity as Parameters<typeof calculateBackgroundColor>[3],
      techLevelColors
    )
  }

  // Scrap or custom with numeric TL — use TL color
  if (techLevel !== undefined && typeof techLevel === 'number') {
    return techLevelColors[techLevel] ?? 'bg-su-orange'
  }

  // Custom fallback
  return 'bg-su-orange'
}

/**
 * Convert CargoRow[] to CargoGridItem[] for grid computation.
 */
export function cargoRowsToGridItems(rows: CargoRow[]): CargoGridItem[] {
  return rows.map((row) => {
    const metadata = row.metadata as Record<string, unknown> | null
    const techLevel = metadata?.tech_level as number | string | undefined
    const isScrap = !row.schema_ref_id && !metadata?.salvage_value && row.amount > 0

    // Resolve reference entity
    let entity: ReturnType<typeof SalvageUnionReference.get> | undefined
    if (row.schema_ref_id && row.schema_name) {
      entity = SalvageUnionReference.get(row.schema_name as EntitySchemaName, row.schema_ref_id)
    }

    // Resolve TL from entity if not in metadata
    let resolvedTechLevel = techLevel
    if (!resolvedTechLevel && entity && 'techLevel' in entity) {
      resolvedTechLevel = entity.techLevel as number | string
    }

    const cargoType: CargoType = row.schema_ref_id ? 'entity' : isScrap ? 'scrap' : 'custom'
    const headerBg = computeHeaderBg(row.schema_name, entity ?? undefined, resolvedTechLevel)

    return {
      cargoId: row.id,
      name: row.name,
      cellCount: getCellCount(row),
      techLevel: resolvedTechLevel,
      headerBg,
      cargoType,
      schemaName: row.schema_name ?? undefined,
      schemaRefId: row.schema_ref_id ?? undefined,
    }
  })
}
