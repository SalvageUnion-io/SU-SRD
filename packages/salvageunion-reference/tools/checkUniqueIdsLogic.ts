/**
 * Pure logic for unique-ID validation across the Salvage Union data.
 *
 * Validates that:
 * 1. All IDs are valid UUIDs (v4 format) — except files in SLUG_ID_FILES
 * 2. All IDs are unique within each file
 * 3. All IDs are unique across all files
 *
 * Extracted from tools/checkUniqueIds.ts so both the standalone CLI and the
 * unified runner (tools/validate.ts) share one implementation over a
 * caller-supplied data bag, instead of each re-reading `data/*.json` itself.
 */

// UUID v4 regex pattern
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Files that use documented semantic slug IDs instead of UUIDv4.
 * catalog-categories uses short slug IDs (e.g. "pilot", "mech") by design —
 * they are exempt from the UUIDv4 format check but still checked for duplicates.
 */
export const SLUG_ID_FILES = new Set(['catalog-categories.json'])

type Action = {
  id?: string
  name?: string
  actions?: Action[]
  [key: string]: unknown
}

type Choice = {
  id?: string
  name?: string
  description?: string
  schema?: string
  [key: string]: unknown
}

type NPC = {
  position?: string
  description?: string
  hitPoints?: number
  choices?: Choice[]
  [key: string]: unknown
}

type Ability = {
  name?: string
  description?: string
  choices?: Choice[]
  [key: string]: unknown
}

type DataItem = {
  id?: string
  choices?: Choice[]
  actions?: Action[]
  npc?: NPC
  abilities?: Ability[]
  [key: string]: unknown
}

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

/** Walk one entity's nested action/choice IDs, invoking `visit` for each `{ id, context }` found. */
function walkEntityIds(item: DataItem, visit: (id: string, context: string) => void): void {
  const checkActions = (actions: unknown[], context: string) => {
    if (!Array.isArray(actions)) return
    actions.forEach((action, actionIndex) => {
      if (typeof action === 'string') return
      if (typeof action === 'object' && action !== null && 'id' in action) {
        const actionObj = action as Action
        if (actionObj.id) visit(actionObj.id, `${context}[${actionIndex}]`)
        if (actionObj.actions) checkActions(actionObj.actions, `${context}[${actionIndex}].actions`)
      }
    })
  }

  const checkChoices = (choices: Choice[], context: string) => {
    if (!Array.isArray(choices)) return
    choices.forEach((choice) => {
      if (choice.id) visit(choice.id, context)
    })
  }

  if (item.id) visit(item.id, 'root')
  if (item.actions) checkActions(item.actions, 'root.actions')
  if (item.choices) checkChoices(item.choices, 'root.choices')
  if (item.npc?.choices) checkChoices(item.npc.choices, 'npc.choices')
  if (item.abilities && Array.isArray(item.abilities)) {
    item.abilities.forEach((ability: Ability, abilityIndex: number) => {
      if (ability.choices) checkChoices(ability.choices, `abilities[${abilityIndex}].choices`)
    })
  }
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
    walkEntityIds(item as DataItem, (id, context) => {
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

    const addToGlobalMap = (id: string, index: number) => {
      const locations = globalIdMap.get(id) || []
      locations.push({ file: filename, indices: [index] })
      globalIdMap.set(id, locations)
    }

    data.forEach((item, index) => {
      walkEntityIds(item as DataItem, (id) => addToGlobalMap(id, index))
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
