import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefChassis } from 'salvageunion-reference'

/** Look up a chassis by its ID. Returns undefined if not found. */
export function findChassisById(chassisRef: string): SURefChassis | undefined {
  return SalvageUnionReference.Chassis.find((c) => c.id === chassisRef)
}
