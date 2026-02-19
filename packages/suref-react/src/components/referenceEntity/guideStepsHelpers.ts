import type { SURefObjectGuideStep } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'

/** Compute per-step display numbers, resetting when a step has a `section` value */
export function getStepNumbers(steps: SURefObjectGuideStep[]): number[] {
  const numbers: number[] = []
  let counter = 0
  for (const step of steps) {
    if (step.section) counter = 0
    counter++
    numbers.push(counter)
  }
  return numbers
}

/** Check if an entity passes a single guide step filter.
 *  If the field doesn't exist on the entity the filter is skipped. */
export function matchesFilter(
  entity: Record<string, unknown>,
  filter: {
    field: string
    operator?: 'eq' | 'ne'
    value?: string | number | boolean
    min?: number
    max?: number
  }
): boolean {
  const fieldValue = entity[filter.field]
  if (fieldValue === undefined) return true
  if (filter.value !== undefined) {
    const op = filter.operator ?? 'eq'
    return op === 'ne' ? fieldValue !== filter.value : fieldValue === filter.value
  }
  if (filter.min !== undefined && (typeof fieldValue !== 'number' || fieldValue < filter.min))
    return false
  if (filter.max !== undefined && (typeof fieldValue !== 'number' || fieldValue > filter.max))
    return false
  return true
}

/** Lazily computed set of core ability tree names from class data */
let _coreTreeNames: Set<string> | null = null
function getCoreTreeNames(): Set<string> {
  if (!_coreTreeNames) {
    _coreTreeNames = new Set(
      SalvageUnionReference.Classes.all().flatMap(
        (c) => ((c as Record<string, unknown>).coreTrees as string[]) ?? []
      )
    )
  }
  return _coreTreeNames
}

/** Get sort priority for a guide entity.
 *  Lower = higher priority: recommended+active (0) > active (1) > disabled (2). */
function getEntitySortPriority(data: unknown, disabled?: boolean): number {
  if (disabled) return 2
  if ((data as { recommended?: boolean }).recommended) return 0
  return 1
}

/** Sort guide entities: recommended+active first, then active, then disabled last.
 *  "Active" = not disabled by constraints; "recommended" = entity data field. */
export function sortGuideEntities(
  entities: { data: unknown; schemaName: string; disabled?: boolean }[]
): { data: unknown; schemaName: string; disabled?: boolean }[] {
  const hasDisabled = entities.some((e) => e.disabled)
  const hasRecommended = entities.some((e) => (e.data as { recommended?: boolean }).recommended)
  if (!hasDisabled && !hasRecommended) return entities

  return [...entities].sort((a, b) => {
    const pa = getEntitySortPriority(a.data, a.disabled)
    const pb = getEntitySortPriority(b.data, b.disabled)
    return pa - pb
  })
}

/** Count the number of visual rows in a roll table object */
function countTableRows(table: Record<string, unknown>): number {
  // Table keys are row labels (e.g. "1", "2-5", "11-19") plus "type"
  return Object.keys(table).filter((k) => k !== 'type').length
}

/**
 * Estimate the relative visual height of an entity for balanced column splitting.
 * Uses content block count, actions, roll tables, and nested entities as heuristics.
 */
function estimateEntityWeight(data: unknown, isListing: boolean): number {
  if (isListing) return 1

  const entity = data as Record<string, unknown>
  // Base weight for header + padding + footer
  let weight = 5
  // Content blocks
  if (Array.isArray(entity.content)) weight += entity.content.length * 1.5
  // Choices
  if (Array.isArray(entity.choices)) weight += entity.choices.length * 2
  // NPC (single npc object with content)
  if (entity.npc && typeof entity.npc === 'object') {
    const npc = entity.npc as Record<string, unknown>
    weight += 5 // NPC card header + padding
    if (Array.isArray(npc.content)) weight += npc.content.length * 1.5
  }

  // Direct table on entity
  if (entity.table && typeof entity.table === 'object') {
    weight += countTableRows(entity.table as Record<string, unknown>) * 2 + 3
  }

  // Actions: resolve each and account for action content + roll tables
  if (Array.isArray(entity.actions)) {
    for (const actionName of entity.actions as string[]) {
      const action = SalvageUnionReference.Actions.find((a) => a.name === actionName)
      weight += 3 // Action header
      if (action) {
        if (Array.isArray(action.content)) weight += action.content.length * 1.5
        // Direct table on action
        if (action.table && typeof action.table === 'object') {
          weight += countTableRows(action.table as Record<string, unknown>) * 2 + 3
        } else {
          // Roll table resolved by action name
          const rt = SalvageUnionReference.RollTables.find((r) => r.name === actionName)
          if (rt?.table) {
            weight += countTableRows(rt.table as unknown as Record<string, unknown>) * 2 + 3
          }
        }
      }
    }
  }

  return weight
}

/**
 * Split entities into two balanced columns using a greedy algorithm.
 * Assigns each entity to whichever column currently has less estimated height.
 */
export function balancedTwoColumnSplit<T extends { data: unknown }>(
  entities: T[],
  isListingFn: (entity: T) => boolean
): [T[], T[]] {
  // Sort heaviest-first for better bin-packing balance
  const weighted = entities.map((entity) => ({
    entity,
    weight: estimateEntityWeight(entity.data, isListingFn(entity)),
  }))
  weighted.sort((a, b) => b.weight - a.weight)

  const left: T[] = []
  const right: T[] = []
  let leftWeight = 0
  let rightWeight = 0

  // If the heaviest entity is dramatically taller than the next, isolate it
  if (weighted.length >= 3 && weighted[0]!.weight > weighted[1]!.weight * 3) {
    left.push(weighted[0]!.entity)
    for (let i = 1; i < weighted.length; i++) {
      right.push(weighted[i]!.entity)
    }
    return [left, right]
  }

  for (const { entity, weight } of weighted) {
    if (leftWeight <= rightWeight) {
      left.push(entity)
      leftWeight += weight
    } else {
      right.push(entity)
      rightWeight += weight
    }
  }

  return [left, right]
}

/** Enrich an entity with computed fields for filtering.
 *  For systems/modules, computes `hasDamage` from resolved actions.
 *  For abilities, computes `treeType` (core/advanced/legendary/generic). */
export function enrichForFiltering(
  entity: Record<string, unknown>,
  schemaName: string
): Record<string, unknown> {
  if ((schemaName === 'systems' || schemaName === 'modules') && Array.isArray(entity.actions)) {
    const hasDamage = (entity.actions as string[]).some((name) => {
      const action = SalvageUnionReference.Actions.find((a) => a.name === name)
      return action?.damage !== undefined
    })
    return { ...entity, hasDamage }
  }
  if (schemaName === 'abilities' && typeof entity.tree === 'string') {
    const tree = entity.tree
    let treeType: string
    if (tree === 'Generic') treeType = 'generic'
    else if (getCoreTreeNames().has(tree)) treeType = 'core'
    else if (tree.startsWith('Legendary')) treeType = 'legendary'
    else treeType = 'advanced'
    return { ...entity, treeType }
  }
  return entity
}
