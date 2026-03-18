import type { EntitySchemaName } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { MechRow, MechUpdate, PilotRow, PilotUpdate, EntityRefRow } from '../types/common'
import { computeInjuryHealingUpdate } from './injuryUtils'
import type { PilotInjury } from './injuryUtils'

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

/** Compute pilot update for restore: HP->max, AP->max, reset one-time re-roll flags */
export function computePilotRestoreUpdate(pilot: PilotRow): PilotUpdate {
  return {
    hp: pilot.max_hp,
    ap: pilot.max_ap,
    keepsake_used: false,
    background_used: false,
    motto_used: false,
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

/**
 * Compute pilot update for restore when a Med Bay is available.
 * Heals injuries appropriate to the Med Bay TL, restores HP to the new max,
 * and resets one-time re-roll flags.
 *
 * - Minor injuries: healed at TL >= 3
 * - Major injuries: healed at TL >= 5
 */
export function computePilotRestoreWithInjuries(
  pilot: PilotRow,
  injuries: PilotInjury[],
  medBayTL: number
): { update: PilotUpdate; healedInjuryCount: number; remainingInjuries: PilotInjury[] } {
  const { remainingInjuries, healedCount, maxHpRestored } = computeInjuryHealingUpdate(
    injuries,
    pilot.max_hp,
    medBayTL
  )
  const newMaxHp = pilot.max_hp + maxHpRestored
  const update: PilotUpdate = {
    hp: newMaxHp,
    ap: pilot.max_ap,
    keepsake_used: false,
    background_used: false,
    motto_used: false,
    ...(healedCount > 0 ? { max_hp: newMaxHp } : {}),
  }
  return { update, healedInjuryCount: healedCount, remainingInjuries }
}
