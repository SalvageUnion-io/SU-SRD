import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefChassis } from 'salvageunion-reference'

/** Look up a chassis by its ID. Returns undefined if not found. */
export function findChassisById(chassisRef: string): SURefChassis | undefined {
  return SalvageUnionReference.Chassis.find((c) => c.id === chassisRef)
}

/** Look up a class name by its ref ID. Returns 'Unknown' if not found. */
export function findClassName(classRef: string): string {
  return SalvageUnionReference.get('classes', classRef)?.name ?? 'Unknown'
}
