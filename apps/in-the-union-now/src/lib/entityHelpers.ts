import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefChassis, SURefEntity, EntitySchemaName } from 'salvageunion-reference'

/** Look up a chassis by its ID. Returns undefined if not found. */
export function findChassisById(chassisRef: string): SURefChassis | undefined {
  return SalvageUnionReference.Chassis.find((c) => c.id === chassisRef)
}

/** Look up a class name by its ref ID. Returns 'Unknown' if not found. */
export function findClassName(classRef: string): string {
  return SalvageUnionReference.get('classes', classRef)?.name ?? 'Unknown'
}

/** Resolve an entity_ref row to its full game data entity. */
export function resolveEntityRef(ref: {
  schema_name: string
  schema_ref_id: string
}): SURefEntity | undefined {
  return SalvageUnionReference.get(ref.schema_name as EntitySchemaName, ref.schema_ref_id) as
    | SURefEntity
    | undefined
}
