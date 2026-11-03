/**
 * pilotInventory — truthful pilot inventory slot + uses math.
 *
 * Slot accounting:
 *   - reference equipment: 1 slot, 2 when Heavy/Portable (ORM getInventorySlots)
 *   - uncarried equipment: 0 (a Mecha Companion walks beside you, see below)
 *   - unresolved slugs: counted at 1 so the total never lies low
 *   - generic entries: explicit slotCost × qty (Scrap = 3 per unit)
 *   - capacity: derived by `pilotMaxInventorySlots` (base 6 +
 *     ability contributions like Beefcake +4),
 *     honouring the absolute maxInventorySlotsOverride pin
 *
 * Uses accounting: an item's max uses come from its `uses` trait
 * (on the equipment record or its matching action). `equipmentUses[slug]`
 * stores uses REMAINING; an absent key means full.
 *
 * Pure functions — no React, no store.
 */

import type { GenericInventoryEntry, Pilot } from 'game-domain/schemas/pilot'
import type { RefEquipment } from 'salvageunion-reference'
import {
  getEntitySlug,
  getInventorySlots,
  getTraits,
  SalvageUnionReference,
} from 'salvageunion-reference'
import { pilotMaxInventorySlots } from 'salvageunion-reference/rules'
import { isPartnerEquipment } from './partnerGrants'

/** Resolve a stored equipment slug (e.g. `remote-mine`) against the reference data. */
export function resolveEquipment(slug: string): RefEquipment | null {
  return SalvageUnionReference.Equipment.getBySlug(slug) ?? null
}

/**
 * The equipment the pilot's abilities grant and the record does not carry (a
 * Custom Sniper Rifle, a Camo Suit): "You acquire …" puts it in their hands, so
 * the sheet and Play show it as carried, its picks saved as any item's. A
 * partner's equipment is not one: its partner is the entry (`pilotPartnerSeeds`).
 */
export function grantedEquipment(pilot: Pick<Pilot, 'abilities' | 'equipment'>): string[] {
  const carried = new Set(pilot.equipment ?? [])
  const out: string[] = []
  for (const ref of pilot.abilities ?? []) {
    const ability = SalvageUnionReference.Abilities.getBySlug(ref)
    if (!ability) continue
    for (const grant of ability.grants ?? []) {
      if (grant.schema !== 'equipment') continue
      const granted = SalvageUnionReference.Equipment.getByName(grant.name)
      if (!granted) continue
      const slug = getEntitySlug(granted)
      if (carried.has(slug) || out.includes(slug) || isPartnerEquipment(slug)) continue
      out.push(slug)
    }
  }
  return out
}

/** What the pilot carries: the record's equipment, then what their abilities grant. */
export function carriedEquipment(pilot: Pick<Pilot, 'abilities' | 'equipment'>): string[] {
  return [...(pilot.equipment ?? []), ...grantedEquipment(pilot)]
}

/**
 * Pilot Equipment a pilot never carries. A Mecha Companion (Core Book p.68)
 * "acts independently of you, on its own turn" and "uses the same rules as
 * Mechs", so it fills no Inventory Slot. Its siblings do: the Auto-Turret is
 * Portable, 2 slots (p.30), and a Survey Drone's Drone Controller is carried
 * Pilot Equipment (p.48), so both keep their trait-derived cost.
 */
const UNCARRIED_EQUIPMENT: ReadonlySet<string> = new Set(['mecha-companion'])

/**
 * Inventory slots one equipment item occupies: 1, or 2 when it carries the
 * Heavy/Portable trait, 0 when it is never carried. Unresolved items count 1.
 */
export function equipmentSlotCost(equipment: RefEquipment | null): number {
  if (!equipment) return 1
  if (UNCARRIED_EQUIPMENT.has(getEntitySlug(equipment))) return 0
  return getInventorySlots(equipment)
}

/**
 * Max uses for an equipment item from its `uses` trait, or null
 * when the item has no uses counter (no trait / variable amount).
 */
export function equipmentMaxUses(equipment: RefEquipment | null): number | null {
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

type PilotCapacityInput = Partial<Pick<Pilot, 'abilities' | 'maxInventorySlotsOverride'>>

/**
 * Inventory capacity (6 base) plus any ability contributions (Beefcake +4),
 * and the absolute `maxInventorySlotsOverride` pin when one is set. Never
 * below 0.
 *
 * Delegating to `pilotMaxInventorySlots` puts it through the same
 * `breakdownOf` as every other derived maximum, so a `maxInventorySlotsOverride`
 * Free-Edit pin takes effect exactly like the HP and AP pins do.
 */
export function pilotInventoryCapacity(pilot?: PilotCapacityInput): number {
  return pilotMaxInventorySlots(pilot ?? {})
}
