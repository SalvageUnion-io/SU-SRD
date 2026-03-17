import { hasObtainedEquipment } from './equipmentUtils'
import type { PilotRow } from '../types/common'
import type { CraftReceipt } from './craftUtils'
import type { TrainingReceipt } from './trainingUtils'
import type { EquipmentReceipt } from './equipmentUtils'

/**
 * Returns the subset of pilots who have not completed all three optional downtime
 * steps (craft, train, equipment) — either by doing the step or explicitly skipping it.
 */
export function getIncompletePilots(
  pilots: PilotRow[],
  craftReceipts: Record<string, CraftReceipt> | null | undefined,
  trainingReceipts: Record<string, TrainingReceipt> | null | undefined,
  equipmentReceipts: Record<string, EquipmentReceipt> | null | undefined
): PilotRow[] {
  return pilots.filter((p) => {
    const cr = craftReceipts?.[p.id] as CraftReceipt | undefined
    const tr = trainingReceipts?.[p.id] as TrainingReceipt | undefined
    const er = equipmentReceipts?.[p.id] as EquipmentReceipt | undefined
    const craftDone = (cr?.crafted_items.length ?? 0) > 0 || cr?.skipped === true
    const trainDone = (tr?.abilities_learned.length ?? 0) > 0 || tr?.skipped === true
    const equipDone = hasObtainedEquipment(er) || er?.skipped === true
    return !craftDone || !trainDone || !equipDone
  })
}
