import { SalvageUnionReference, getGrants } from 'salvageunion-reference'
import type { EntitySchemaName, SURefEntity } from 'salvageunion-reference'
import type { EntityRefRow } from '../types/common'

/**
 * Resolve equipment granted by abilities.
 * Takes ability entity_refs, resolves each to its ability entity,
 * extracts grants with schema === 'equipment', and resolves to equipment entities.
 */
export function resolveGrantedEquipment(abilityRefs: EntityRefRow[]): SURefEntity[] {
  const result: SURefEntity[] = []

  for (const ref of abilityRefs) {
    const ability = SalvageUnionReference.get(
      ref.schema_name as EntitySchemaName,
      ref.schema_ref_id
    )
    if (!ability) continue

    const grants = getGrants(ability)
    if (!grants) continue

    for (const grant of grants) {
      if (grant.schema !== 'equipment') continue

      const equipment = SalvageUnionReference.findIn('equipment', (e) => e.name === grant.name)
      if (equipment) result.push(equipment)
    }
  }

  return result
}
