import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { filterByTechLevel } from './tradeUtils'

export type EquipmentReceipt = {
  item: { ref_id: string; name: string } | null
  skipped?: true
}

/** Get all pilot equipment entities filtered by crawler TL */
export function getAvailableEquipment(crawlerTL: number): SURefEntity[] {
  const all = SalvageUnionReference.findAllIn('equipment', () => true) as SURefEntity[]
  return filterByTechLevel(
    all as (SURefEntity & { techLevel?: number | string })[],
    crawlerTL
  ) as SURefEntity[]
}

/** Check if pilot has already obtained equipment this downtime */
export function hasObtainedEquipment(receipt: EquipmentReceipt | undefined): boolean {
  return !!receipt && receipt.item !== null
}
