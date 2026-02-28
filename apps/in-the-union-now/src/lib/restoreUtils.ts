import type { EntitySchemaName } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { MechRow, MechUpdate, PilotRow, PilotUpdate, EntityRefRow } from '../types/common'

export type RestoreReceipt = {
  mech_restored: boolean
  pilot_restored: boolean
  items_repaired: number
  comrades_healed: number
}

/** Check if a pilot has completed both restore actions */
export function isRestoreComplete(receipt: RestoreReceipt | undefined): boolean {
  return !!receipt && receipt.mech_restored && receipt.pilot_restored
}

/** Compute mech update for restore: SP->max, EP->max, Heat->0 */
export function computeMechRestoreUpdate(mech: MechRow): MechUpdate {
  return {
    current_sp: mech.max_sp,
    current_ep: mech.max_ep,
    current_heat: 0,
  }
}

/** Compute pilot update for restore: HP->max, AP->max */
export function computePilotRestoreUpdate(pilot: PilotRow): PilotUpdate {
  return {
    hp: pilot.max_hp,
    ap: pilot.max_ap,
  }
}

/**
 * Find damaged entity refs whose resolved entity has a numeric TL <= crawlerTL.
 * TechLevel can be number | 'B' | 'N' — only numeric TLs compare against crawlerTL.
 * Destroyed items are NOT repaired (only damaged -> intact).
 */
export function findRepairableRefs(refs: EntityRefRow[], crawlerTL: number): string[] {
  const repairableIds: string[] = []

  for (const ref of refs) {
    if (ref.condition !== 'damaged') continue

    const entity = SalvageUnionReference.get(ref.schema_name as EntitySchemaName, ref.schema_ref_id)
    if (!entity) continue

    // Check techLevel directly — only numeric TLs compare against crawlerTL
    const tl = 'techLevel' in entity ? entity.techLevel : undefined
    if (typeof tl === 'number' && tl <= crawlerTL) {
      repairableIds.push(ref.id)
    }
  }

  return repairableIds
}
