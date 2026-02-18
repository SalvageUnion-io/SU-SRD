import {
  SalvageUnionReference,
  getSalvageValue,
  getTechLevelNumber,
  type SURefChassis,
  type SURefSystem,
  type SURefModule,
  type SURefObjectPatternSystemModule,
} from 'salvageunion-reference'
import type { PatternItem, CreatePatternInput } from '../types/common'

export const STARTING_MECH_BUDGET = 20

export type ResolvedItem = PatternItem & {
  entity: SURefSystem | SURefModule
}

export type CapacityInfo = {
  systemSlotsUsed: number
  systemSlotsTotal: number
  moduleSlotsUsed: number
  moduleSlotsTotal: number
  isOverSystemCapacity: boolean
  isOverModuleCapacity: boolean
  isValid: boolean
}

export type BuilderState = {
  name: string
  chassisRef: string | null
  description: string
  visible: boolean
  customImageUrl: string | null
  items: PatternItem[]
}

/**
 * Resolves PatternItem[] to entities via SalvageUnionReference.get().
 * Items whose entity can't be found are excluded.
 */
export function resolvePatternItems(items: PatternItem[]): ResolvedItem[] {
  const resolved: ResolvedItem[] = []
  for (const item of items) {
    const entity = SalvageUnionReference.get(item.schema_name, item.schema_ref_id) as
      | SURefSystem
      | SURefModule
      | undefined
    if (entity) {
      resolved.push({ ...item, entity })
    }
  }
  return resolved
}

/**
 * Compute slot capacity usage given a chassis and resolved items.
 * Returns slot counts and whether the build is over capacity.
 */
export function computeCapacity(
  chassis: SURefChassis | null | undefined,
  resolvedItems: ResolvedItem[]
): CapacityInfo {
  const systemSlotsTotal = chassis?.systemSlots ?? 0
  const moduleSlotsTotal = chassis?.moduleSlots ?? 0

  let systemSlotsUsed = 0
  let moduleSlotsUsed = 0

  for (const item of resolvedItems) {
    const slots = item.entity.slotsRequired ?? 1
    if (item.schema_name === 'systems') {
      systemSlotsUsed += slots
    } else {
      moduleSlotsUsed += slots
    }
  }

  const isOverSystemCapacity = systemSlotsUsed > systemSlotsTotal
  const isOverModuleCapacity = moduleSlotsUsed > moduleSlotsTotal

  return {
    systemSlotsUsed,
    systemSlotsTotal,
    moduleSlotsUsed,
    moduleSlotsTotal,
    isOverSystemCapacity,
    isOverModuleCapacity,
    isValid: !isOverSystemCapacity && !isOverModuleCapacity,
  }
}

export type SalvageValueInfo = {
  chassisCost: number
  itemsCost: number
  totalCost: number
  totalTL1Cost: number
  remainingBudget: number
  isLegalStartingMech: boolean
}

/**
 * Compute total salvage value for a chassis + items build.
 * Uses getSalvageValue() from salvageunion-reference for each entity.
 */
export function computeSalvageValue(
  chassis: SURefChassis | null | undefined,
  resolvedItems: ResolvedItem[]
): SalvageValueInfo {
  const chassisCost = (chassis ? getSalvageValue(chassis) : undefined) ?? 0
  let itemsCost = 0
  for (const item of resolvedItems) {
    itemsCost += getSalvageValue(item.entity) ?? 0
  }
  const totalCost = chassisCost + itemsCost

  // Compute TL1-equivalent scrap value: each item's SV * its tech level
  const chassisTL1 = chassisCost * (chassis ? (getTechLevelNumber(chassis) ?? 1) : 1)
  let itemsTL1 = 0
  for (const item of resolvedItems) {
    const sv = getSalvageValue(item.entity) ?? 0
    const tl = getTechLevelNumber(item.entity) ?? 1
    itemsTL1 += sv * tl
  }
  const totalTL1Cost = chassisTL1 + itemsTL1

  return {
    chassisCost,
    itemsCost,
    totalCost,
    totalTL1Cost,
    remainingBudget: STARTING_MECH_BUDGET - totalCost,
    isLegalStartingMech: totalCost <= STARTING_MECH_BUDGET,
  }
}

/**
 * Returns the next sort_order value (max + 1, or 0 if empty).
 */
export function nextSortOrder(items: PatternItem[]): number {
  if (items.length === 0) return 0
  return Math.max(...items.map((i) => i.sort_order)) + 1
}

/**
 * Converts a TypedPatternRow (from DB) into BuilderState for the MechBuilder.
 */
export function patternToBuilderState(pattern: {
  name: string
  chassis_ref: string
  description: string | null
  visible: boolean
  pattern_items: PatternItem[]
}): BuilderState {
  return {
    name: pattern.name,
    chassisRef: pattern.chassis_ref,
    description: pattern.description ?? '',
    visible: pattern.visible,
    customImageUrl: null,
    items: pattern.pattern_items,
  }
}

/**
 * Converts PatternItem[] into the { systems, modules } format expected by
 * useChassisPatternConfig's patternOverride input. Groups duplicate items by name with count.
 */
export function patternItemsToOverride(items: PatternItem[]): {
  systems: { name: string; count?: number }[]
  modules: { name: string; count?: number }[]
} {
  const systemCounts = new Map<string, { name: string; count: number }>()
  const moduleCounts = new Map<string, { name: string; count: number }>()

  for (const item of items) {
    const entity = SalvageUnionReference.get(item.schema_name, item.schema_ref_id) as
      | SURefSystem
      | SURefModule
      | undefined
    if (!entity) continue

    const map = item.schema_name === 'systems' ? systemCounts : moduleCounts
    const existing = map.get(item.schema_ref_id)
    if (existing) {
      existing.count += 1
    } else {
      map.set(item.schema_ref_id, { name: entity.name, count: 1 })
    }
  }

  const toArray = (map: Map<string, { name: string; count: number }>) =>
    [...map.values()].map((e) =>
      e.count > 1 ? { name: e.name, count: e.count } : { name: e.name }
    )

  return { systems: toArray(systemCounts), modules: toArray(moduleCounts) }
}

/**
 * Converts a reference pattern's systems/modules (by name, with count) to PatternItem[].
 * Skips entries whose name can't be resolved to an entity.
 */
export function referencePatternToItems(
  systems: SURefObjectPatternSystemModule[],
  modules: SURefObjectPatternSystemModule[]
): PatternItem[] {
  const items: PatternItem[] = []
  let sortOrder = 0

  for (const sys of systems) {
    const entity = SalvageUnionReference.Systems.find((s) => s.name === sys.name)
    if (!entity) continue
    const count = sys.count ?? 1
    for (let i = 0; i < count; i++) {
      items.push({ schema_name: 'systems', schema_ref_id: entity.id, sort_order: sortOrder++ })
    }
  }

  for (const mod of modules) {
    const entity = SalvageUnionReference.Modules.find((m) => m.name === mod.name)
    if (!entity) continue
    const count = mod.count ?? 1
    for (let i = 0; i < count; i++) {
      items.push({ schema_name: 'modules', schema_ref_id: entity.id, sort_order: sortOrder++ })
    }
  }

  return items
}

/**
 * Applies a pattern's items to the current builder state, replacing all items.
 * Preserves name, description, visible, customImageUrl, and chassisRef.
 */
export function applyPatternItems(
  currentState: BuilderState,
  patternItems: PatternItem[]
): BuilderState {
  return {
    ...currentState,
    items: patternItems.map((item, i) => ({
      schema_name: item.schema_name,
      schema_ref_id: item.schema_ref_id,
      sort_order: i,
    })),
  }
}

/**
 * Serializes BuilderState to CreatePatternInput.
 * Returns null if the state is invalid (no name or no chassis).
 */
export function builderToCreateInput(state: BuilderState): CreatePatternInput | null {
  if (!state.name.trim() || !state.chassisRef) return null

  return {
    name: state.name.trim(),
    chassis_ref: state.chassisRef,
    description: state.description.trim() || undefined,
    visible: state.visible,
    pattern_items: state.items,
  }
}
