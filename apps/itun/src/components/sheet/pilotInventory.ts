/**
 * pilotInventory — truthful pilot inventory slot + uses math (plan 4.4,
 * rules A13/A14).
 *
 * Slot accounting:
 *   - reference equipment: 1 slot, 2 when Heavy/Portable (ORM getInventorySlots)
 *   - unresolved slugs: counted at 1 so the total never lies low
 *   - generic entries: explicit slotCost × qty (Scrap = 3 per unit, plan S7)
 *   - capacity: base 6 + maxInventorySlotsModifier + ability contributions
 *     (Beefcake +4, rules A13 — now applied from the ability, not hand-entered)
 *
 * Uses accounting (rules A14): an item's max uses come from its `uses` trait
 * (on the equipment record or its matching action). `equipmentUses[slug]`
 * stores uses REMAINING; an absent key means full.
 *
 * Pure functions — no React, no IndexedDB.
 */

import { SalvageUnionReference, getInventorySlots, getTraits } from 'salvageunion-reference'
import type { SURefEquipment } from 'salvageunion-reference'

import type { GenericInventoryEntry, Pilot } from '../../lib/schemas/pilot'
import { abilityContributions, sumContributions } from 'salvageunion-reference/rules'
import { PILOT_BASE_INVENTORY_SLOTS } from '../../lib/rules/derivedStats'
import { matchesRef } from 'salvageunion-reference/rules'

/**
 * Resolve an equipment ref (slug, name, or id) against the reference data.
 * Seeded records store kebab slugs (e.g. `remote-mine`, `survey-drone`), so the
 * match must be slug-tolerant via `matchesRef` — an id/name-only match silently
 * fails every slug and renders the item as a raw-slug chit.
 */
export function resolveEquipment(slug: string): SURefEquipment | null {
  const all = SalvageUnionReference.Equipment.all()
  return all.find((e) => matchesRef(e, slug)) ?? null
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
  Partial<Pick<Pilot, 'abilities'>>

/**
 * Inventory capacity (rules A13: 6 base) plus the hand-edited passive bonus
 * (`maxInventorySlotsModifier`) PLUS any ability contributions (Beefcake +4).
 * Never below 0.
 */
export function pilotInventoryCapacity(pilot?: PilotCapacityInput): number {
  const fromAbilities = sumContributions(
    abilityContributions(pilot?.abilities, 'pilot', 'inventorySlots')
  )
  return Math.max(
    0,
    PILOT_BASE_INVENTORY_SLOTS + (pilot?.maxInventorySlotsModifier ?? 0) + fromAbilities
  )
}
