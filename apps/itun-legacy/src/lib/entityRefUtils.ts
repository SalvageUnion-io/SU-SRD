import type { EntityRefInsert } from '../types/common'

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
