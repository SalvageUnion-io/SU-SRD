/**
 * pilotInventory — truthful pilot inventory slot + uses math (plan 4.4,
 * rules A13/A14).
 *
 * Slot accounting:
 *   - reference equipment: 1 slot, 2 when Heavy/Portable (ORM getInventorySlots)
 *   - unresolved slugs: counted at 1 so the total never lies low
 *   - generic entries: explicit slotCost × qty (Scrap = 3 per unit, plan S7)
 *   - capacity: derived by `pilotMaxInventorySlots` (base 6 +
 *     maxInventorySlotsModifier + ability contributions like Beefcake +4,
 *     rules A13), honouring the absolute maxInventorySlotsOverride pin
 *
 * Uses accounting (rules A14): an item's max uses come from its `uses` trait
 * (on the equipment record or its matching action). `equipmentUses[slug]`
 * stores uses REMAINING; an absent key means full.
 *
 * Pure functions — no React, no IndexedDB.
 */

import type { SURefEquipment } from 'salvageunion-reference'
import { getInventorySlots, getTraits, SalvageUnionReference } from 'salvageunion-reference'
import { pilotMaxInventorySlots } from 'salvageunion-reference/rules'
import type { GenericInventoryEntry, Pilot } from '../../lib/schemas/pilot'

/** Resolve a stored equipment slug (e.g. `remote-mine`) against the reference data. */
export function resolveEquipment(slug: string): SURefEquipment | null {
  return SalvageUnionReference.Equipment.getBySlug(slug) ?? null
}

/**
 * Inventory slots one equipment item occupies: 1, or 2 when it carries the
 * Heavy/Portable trait (rules A13). Unresolved items count 1.
 */
export function equipmentSlotCost(equipment: SURefEquipment | null): number {
  if (!equipment) return 1
  return getInventorySlots(equipment)
}

/**
 * Max uses for an equipment item from its `uses` trait (rules A14), or null
 * when the item has no uses counter (no trait / variable amount).
 */
export function equipmentMaxUses(equipment: SURefEquipment | null): number | null {
  if (!equipment) return null
  const traits = getTraits(equipment)
  for (const trait of traits ?? []) {
    if (trait.type === 'uses' && typeof trait.amount === 'number') {
      return trait.amount
    }
  }
  return null
}

/** Slots a generic entry occupies: explicit slotCost × qty (absent qty = 1). */
export function genericEntrySlots(entry: GenericInventoryEntry): number {
  return entry.slotCost * (entry.qty ?? 1)
}

type PilotInventoryInput = Pick<Pilot, 'equipment' | 'genericInventory'>

/** Total slots used: all equipment + all generic entries. */
export function pilotInventoryUsed(pilot: PilotInventoryInput): number {
  const equipmentSlots = pilot.equipment.reduce(
    (sum, slug) => sum + equipmentSlotCost(resolveEquipment(slug)),
    0
  )
  const genericSlots = (pilot.genericInventory ?? []).reduce(
    (sum, entry) => sum + genericEntrySlots(entry),
    0
  )
  return equipmentSlots + genericSlots
}

type PilotCapacityInput = Pick<Pilot, 'maxInventorySlotsModifier'> &
  Partial<Pick<Pilot, 'abilities' | 'maxInventorySlotsOverride'>>

/**
 * Inventory capacity (rules A13: 6 base) plus the hand-edited passive bonus
 * (`maxInventorySlotsModifier`) PLUS any ability contributions (Beefcake +4),
 * and the absolute `maxInventorySlotsOverride` pin when one is set. Never
 * below 0.
 *
 * This used to inline the arithmetic, which is why `maxInventorySlotsOverride`
 * — in the persisted Pilot schema since the cap-override work — was read by
 * nothing: a Free-Edit pin wrote a value this gauge then ignored. Delegating to
 * `pilotMaxInventorySlots` puts it through the same `breakdownOf` as every
 * other derived maximum, so the pin now takes effect exactly like the HP and AP
 * pins do. The unpinned number is unchanged.
 */
export function pilotInventoryCapacity(pilot?: PilotCapacityInput): number {
  return pilotMaxInventorySlots(pilot ?? {})
}
