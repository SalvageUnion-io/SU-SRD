/**
 * Pure logic for unique-ID validation across the Salvage Union data.
 *
 * Validates that every `id`, at any depth of a row:
 * 1. is a valid UUID (v4 format) — except in files in SLUG_ID_FILES
 * 2. is unique within its file
 * 3. is unique across all files
 *
 * Pure over a caller-supplied data bag, so `tools/validate.ts` (the one CLI,
 * `--only=ids`) and the tests share one implementation.
 */

// UUID v4 regex pattern
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Files that use documented semantic slug IDs instead of UUIDv4.
 * catalog-categories uses short slug IDs (e.g. "pilot", "mech") by design —
 * they are exempt from the UUIDv4 format check but still checked for duplicates.
 */
export const SLUG_ID_FILES = new Set(['catalog-categories.json'])

export type FileResult = {
  file: string
  totalItems: number
  itemsWithIds: number
  invalidUUIDs: Array<{ id: string; index: number; context: string }>
  duplicatesInFile: Array<{ id: string; indices: number[] }>
}

export type ValidationResult = {
  files: FileResult[]
  globalDuplicates: Array<{
    id: string
    files: Array<{ file: string; indices: number[] }>
  }>
  totalIds: number
  uniqueIds: number
  invalidIds: number
  duplicateIds: number
}

export function validateUUID(id: string): boolean {
  return UUID_PATTERN.test(id)
}

/**
 * Visit every string `id` at any depth of one row — the row's own, its
 * actions', choices', guide steps', and any shape added later — with the path
 * it sits at. Walking every key (not a hand-kept list of known nests) is what
 * keeps a new nested id from escaping the check.
 */
function walkEntityIds(item: unknown, visit: (id: string, context: string) => void): void {
  const walk = (value: unknown, context: string): void => {
    if (Array.isArray(value)) {
      for (const [i, child] of value.entries()) walk(child, `${context}[${i}]`)
      return
    }
    if (value === null || typeof value !== 'object') return
    for (const [key, child] of Object.entries(value)) {
      if (key === 'id' && typeof child === 'string') visit(child, context)
      else walk(child, `${context}.${key}`)
    }
  }
  walk(item, 'root')
}

export function checkFile(filename: string, data: Record<string, unknown>[]): FileResult {
  const result: FileResult = {
    file: filename,
    totalItems: data.length,
    itemsWithIds: 0,
    invalidUUIDs: [],
    duplicatesInFile: [],
  }

  const idMap = new Map<string, number[]>()

  data.forEach((item, index) => {
    walkEntityIds(item, (id, context) => {
      result.itemsWithIds++
      if (!SLUG_ID_FILES.has(filename) && !validateUUID(id)) {
        result.invalidUUIDs.push({ id, index, context })
      }
      const indices = idMap.get(id) || []
      indices.push(index)
      idMap.set(id, indices)
    })
  })

  idMap.forEach((indices, id) => {
    if (indices.length > 1) {
      result.duplicatesInFile.push({ id, indices })
    }
  })

  return result
}

/** Run the full unique-ID check over every supplied data file. */
export function checkAllFiles(
  filesByName: Record<string, Record<string, unknown>[]>
): ValidationResult {
  const fileResults: FileResult[] = []
  const globalIdMap = new Map<string, Array<{ file: string; indices: number[] }>>()

  for (const [filename, data] of Object.entries(filesByName)) {
    fileResults.push(checkFile(filename, data))

    data.forEach((item, index) => {
      walkEntityIds(item, (id) => {
        const locations = globalIdMap.get(id) || []
        const here = locations.find((l) => l.file === filename)
        if (here) here.indices.push(index)
        else locations.push({ file: filename, indices: [index] })
        globalIdMap.set(id, locations)
      })
    })
  }

  const globalDuplicates: ValidationResult['globalDuplicates'] = []
  globalIdMap.forEach((locations, id) => {
    if (locations.length > 1) {
      globalDuplicates.push({ id, files: locations })
    }
  })

  const totalIds = fileResults.reduce((sum, r) => sum + r.itemsWithIds, 0)
  const uniqueIds = globalIdMap.size
  const invalidIds = fileResults.reduce((sum, r) => sum + r.invalidUUIDs.length, 0)
  const duplicateIds = globalDuplicates.length

  return { files: fileResults, globalDuplicates, totalIds, uniqueIds, invalidIds, duplicateIds }
}
