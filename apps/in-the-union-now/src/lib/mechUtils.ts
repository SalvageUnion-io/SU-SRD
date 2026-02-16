import { SalvageUnionReference, type SURefChassis } from 'salvageunion-reference'
import type { PatternItem, EntityRefInsert } from '../types/common'
import type { BuilderState } from './builderUtils'

// ---------------------------------------------------------------------------
// Mech Stats Computation
// ---------------------------------------------------------------------------

export type MechStats = {
  max_sp: number
  max_ep: number
  heat_capacity: number
  cargo_capacity: number
}

/** Compute base stats from a chassis entity */
export function computeMechStatsFromChassis(chassis: SURefChassis): MechStats {
  return {
    max_sp: chassis.structurePoints ?? 0,
    max_ep: chassis.energyPoints ?? 0,
    heat_capacity: chassis.heatCapacity ?? 0,
    cargo_capacity: chassis.cargoCapacity ?? 0,
  }
}

/** Compute full stats from a chassis ref (looks up the chassis) */
export function computeMechStatsFromRef(chassisRef: string): MechStats | null {
  const chassis = SalvageUnionReference.get('chassis', chassisRef) as SURefChassis | undefined
  if (!chassis) return null
  return computeMechStatsFromChassis(chassis)
}

// ---------------------------------------------------------------------------
// Entity Ref Generation
// ---------------------------------------------------------------------------

/** Convert pattern items to entity_ref insert rows for a mech */
export function patternItemsToEntityRefs(
  mechId: string,
  userId: string,
  items: PatternItem[]
): EntityRefInsert[] {
  return items.map((item) => ({
    parent_id: mechId,
    parent_type: 'mech' as const,
    schema_name: item.schema_name,
    schema_ref_id: item.schema_ref_id,
    sort_order: item.sort_order,
    user_id: userId,
  }))
}

/** Create an entity_ref for a pilot's ability */
export function abilityToEntityRef(
  pilotId: string,
  userId: string,
  abilityRef: { schema_name: string; schema_ref_id: string }
): EntityRefInsert {
  return {
    parent_id: pilotId,
    parent_type: 'pilot' as const,
    schema_name: abilityRef.schema_name,
    schema_ref_id: abilityRef.schema_ref_id,
    sort_order: 0,
    user_id: userId,
  }
}

/** Create entity_refs for a pilot's equipment */
export function equipmentToEntityRefs(
  pilotId: string,
  userId: string,
  refs: { schema_name: string; schema_ref_id: string }[]
): EntityRefInsert[] {
  return refs.map((ref, index) => ({
    parent_id: pilotId,
    parent_type: 'pilot' as const,
    schema_name: ref.schema_name,
    schema_ref_id: ref.schema_ref_id,
    sort_order: index + 1, // ability is sort_order 0
    user_id: userId,
  }))
}

// ---------------------------------------------------------------------------
// BuilderState Bridge (for inline mech editing)
// ---------------------------------------------------------------------------

import type { EntityRefRow, MechRow } from '../types/common'

/** Convert a mech + its entity_refs into a BuilderState for MechBuilder reuse */
export function entityRefsToBuilderState(mech: MechRow, entityRefs: EntityRefRow[]): BuilderState {
  const items: PatternItem[] = entityRefs
    .filter((ref) => ref.schema_name === 'systems' || ref.schema_name === 'modules')
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((ref) => ({
      schema_name: ref.schema_name as 'systems' | 'modules',
      schema_ref_id: ref.schema_ref_id,
      sort_order: ref.sort_order,
    }))

  return {
    name: mech.pattern_name ?? '',
    chassisRef: mech.chassis_ref,
    description: '',
    visible: true,
    customImageUrl: mech.image_path,
    items,
  }
}

/** Diff old entity_refs vs new BuilderState to produce insert/delete operations */
export function builderStateToPatchOps(
  oldRefs: EntityRefRow[],
  newState: BuilderState,
  mechId: string,
  userId: string
): { inserts: EntityRefInsert[]; deleteIds: string[] } {
  // Only consider system/module refs (not other types that might be on the mech)
  const mechRefs = oldRefs.filter(
    (ref) => ref.schema_name === 'systems' || ref.schema_name === 'modules'
  )

  // Build a frequency map of old refs: "schema_name::schema_ref_id" → [ref ids]
  const oldMap = new Map<string, string[]>()
  for (const ref of mechRefs) {
    const key = `${ref.schema_name}::${ref.schema_ref_id}`
    const existing = oldMap.get(key) ?? []
    existing.push(ref.id)
    oldMap.set(key, existing)
  }

  // Build a frequency map of new items
  const newMap = new Map<string, number>()
  for (const item of newState.items) {
    const key = `${item.schema_name}::${item.schema_ref_id}`
    newMap.set(key, (newMap.get(key) ?? 0) + 1)
  }

  const deleteIds: string[] = []
  const inserts: EntityRefInsert[] = []

  // For each old ref, check if it's still needed
  for (const [key, refIds] of oldMap) {
    const neededCount = newMap.get(key) ?? 0
    const excessCount = refIds.length - neededCount
    if (excessCount > 0) {
      // Delete the excess refs (from the end)
      deleteIds.push(...refIds.slice(neededCount))
    }
  }

  // For each new item, check if we need more
  let sortOrder = 0
  for (const item of newState.items) {
    const key = `${item.schema_name}::${item.schema_ref_id}`
    const existingCount = oldMap.get(key)?.length ?? 0
    const alreadyHandled = newMap.get(key)!
    // We track how many of this key we've already accounted for
    // by counting down in the newMap
    const remaining = alreadyHandled
    newMap.set(key, remaining - 1)

    // Only insert if we need more than we already have
    if (remaining > existingCount) {
      inserts.push({
        parent_id: mechId,
        parent_type: 'mech' as const,
        schema_name: item.schema_name,
        schema_ref_id: item.schema_ref_id,
        sort_order: sortOrder,
        user_id: userId,
      })
    }
    sortOrder++
  }

  return { inserts, deleteIds }
}
