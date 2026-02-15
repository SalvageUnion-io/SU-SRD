import {
  SalvageUnionReference,
  type SURefChassis,
  type SURefSystem,
  type SURefModule,
} from 'salvageunion-reference'
import type { PatternItem, CreatePatternInput } from '../types/common'

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

/**
 * Returns the next sort_order value (max + 1, or 0 if empty).
 */
export function nextSortOrder(items: PatternItem[]): number {
  if (items.length === 0) return 0
  return Math.max(...items.map((i) => i.sort_order)) + 1
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
