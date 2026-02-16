import type { SURefEntity } from 'salvageunion-reference'
import { getTechLevel, getSource, getSalvageValue } from 'salvageunion-reference'

export type TechLevelValue = number | 'B' | 'N'

export const ALL_TECH_LEVELS: TechLevelValue[] = [1, 2, 3, 4, 5, 6, 'B', 'N']

function getEntityName(entity: SURefEntity): string {
  return 'name' in entity ? (entity.name as string) : ''
}

export function getEntityId(entity: SURefEntity): string {
  return 'id' in entity ? (entity.id as string) : ''
}

function getSlotsRequired(entity: SURefEntity): number | undefined {
  if ('slotsRequired' in entity) return entity.slotsRequired as number
  return undefined
}

type FilterAndSplitOptions = {
  entities: SURefEntity[]
  search: string
  activeTechLevels: Set<TechLevelValue>
  activeSourceFilters: Set<string>
  remainingSlots?: number
  remainingBudget?: number
  filter?: (entity: { id: string; name: string }) => boolean
}

type FilterAndSplitResult = {
  selectable: SURefEntity[]
  overCapacity: SURefEntity[]
  overBudget: SURefEntity[]
}

/**
 * Filters, sorts, and splits entities into selectable vs over-capacity groups.
 * Extracted from EntitySelectionModal for testability.
 */
export function filterAndSplitEntities({
  entities,
  search,
  activeTechLevels,
  activeSourceFilters,
  remainingSlots,
  remainingBudget,
  filter,
}: FilterAndSplitOptions): FilterAndSplitResult {
  let filtered = entities

  // External filter
  if (filter) {
    filtered = filtered.filter((e) => filter({ id: getEntityId(e), name: getEntityName(e) }))
  }

  // Search filter
  if (search.trim()) {
    const q = search.trim().toLowerCase()
    filtered = filtered.filter((e) => getEntityName(e).toLowerCase().includes(q))
  }

  // Tech level filter
  filtered = filtered.filter((e) => {
    const tl = getTechLevel(e)
    if (tl === undefined) return true
    return activeTechLevels.has(tl as TechLevelValue)
  })

  // Source filter
  if (activeSourceFilters.size > 0) {
    filtered = filtered.filter((e) => {
      const src = getSource(e)
      if (!src) return true
      return activeSourceFilters.has(src)
    })
  }

  // Sort alphabetically
  filtered.sort((a, b) => getEntityName(a).localeCompare(getEntityName(b)))

  // Split by capacity
  if (remainingSlots === undefined && remainingBudget === undefined) {
    return { selectable: filtered, overCapacity: [], overBudget: [] }
  }

  const selectable: SURefEntity[] = []
  const overCapacity: SURefEntity[] = []

  for (const entity of filtered) {
    const slots = getSlotsRequired(entity)
    if (remainingSlots !== undefined && slots !== undefined && slots > remainingSlots) {
      overCapacity.push(entity)
    } else {
      selectable.push(entity)
    }
  }

  // Second pass: split selectable by budget
  if (remainingBudget === undefined) {
    return { selectable, overCapacity, overBudget: [] }
  }

  const withinBudget: SURefEntity[] = []
  const overBudget: SURefEntity[] = []

  for (const entity of selectable) {
    const sv = getSalvageValue(entity)
    if (sv !== undefined && sv > remainingBudget) {
      overBudget.push(entity)
    } else {
      withinBudget.push(entity)
    }
  }

  return { selectable: withinBudget, overCapacity, overBudget }
}
