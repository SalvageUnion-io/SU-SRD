/**
 * The Pilot inventory-slot rule: an item takes one slot, or two if it is Heavy
 * or Portable.
 *
 * This is a RULE, not a field extractor, and by rights belongs beside the other
 * pure rules math in `lib/rules/` (ADR-006). It is parked here instead because
 * `lib/rules/` is published as the separate `salvageunion-reference/rules`
 * entry point: moving it there would either add a name to that entry point's
 * public surface or remove one from the main barrel, and this split is meant to
 * be invisible from outside the package. Its one consumer
 * (`apps/itun/src/components/sheet/pilotInventory.ts`) imports it from the main
 * barrel today.
 *
 * Split out of the old `lib/utilities.ts` grab bag; still re-exported from
 * there (and from the package barrel).
 */

import { getTraits } from './actionResolution.js'
import type { SURefMetaEntity } from './types/index.js'

/**
 * Get the number of inventory slots an equipment entity occupies.
 * Default is 1. Heavy or Portable traits make it 2.
 */

export function getInventorySlots(entity: SURefMetaEntity): number {
  const traits = getTraits(entity)
  if (traits) {
    for (const t of traits) {
      if (t.type === 'heavy' || t.type === 'portable') return 2
    }
  }
  return 1
}
