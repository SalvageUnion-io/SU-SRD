/**
 * Cargo capacity rule enforcement (REQ-015).
 *
 * Computes slot usage across reference-linked and custom cargo items, and
 * surfaces violations. All operations are pure and synchronous.
 *
 * Reference-linked items (`kind: 'ref'`) are resolved against the
 * salvageunion-reference Equipment dataset by name. If a ref cannot be found,
 * a `missing-ref` violation is produced and that item is counted at 1 slot
 * so capacity math doesn't silently hide missing entries.
 *
 * Custom items (`kind: 'custom'`) carry their slot count explicitly.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import type { CargoCapacityResult, CargoItem, CargoParent, CargoViolation } from './types'

/**
 * Fallback slot cost when a ref-linked item can't be resolved.
 * Using 1 means the item is still counted — missing refs are flagged but
 * don't silently zero out.
 */
const MISSING_REF_SLOT_FALLBACK = 1

/**
 * Resolve the slot cost of a ref-linked cargo item.
 *
 * Resolution order:
 * 1. Explicit `slotCount` override on the item
 * 2. `cargoCapacity` field on an Equipment record (pilot gear — the field that
 *    represents how many cargo slots the item itself occupies is stored as
 *    `salvageValue` in older data; for equipment the canonical slot cost comes
 *    from `slotsRequired` on systems/modules or 1 for equipment)
 * 3. Fallback: 1 slot (and the violation is already recorded by the caller)
 *
 * NOTE: Equipment in salvageunion-reference does not have a `slotsRequired`
 * field — equipment is pilot-carried gear, not mech-installed systems. The SRD
 * treats each distinct equipment item as occupying 1 cargo slot unless the item
 * description states otherwise. We use 1 as the canonical default.
 */
function resolveRefSlotCost(ref: string, override?: number): { slots: number; found: boolean } {
  if (override !== undefined) return { slots: override, found: true }

  // Try equipment first (pilot gear — most common cargo)
  const equipment = SalvageUnionReference.Equipment.find((e) => e.name === ref)
  if (equipment) return { slots: 1, found: true }

  // Try systems (bulk cargo scenario)
  const system = SalvageUnionReference.Systems.find((s) => s.name === ref)
  if (system) return { slots: system.slotsRequired, found: true }

  // Try modules
  const module = SalvageUnionReference.Modules.find((m) => m.name === ref)
  if (module) return { slots: module.slotsRequired, found: true }

  return { slots: MISSING_REF_SLOT_FALLBACK, found: false }
}

/**
 * Compute cargo capacity for a parent entity (mech or crawler) given its
 * cargo item list.
 *
 * Violation kinds:
 * - `missing-ref` — a ref-linked item's name doesn't match any known SU entity
 * - `over-capacity` — total slot usage exceeds `parent.cargoCapacity`
 */
export function computeCargoCapacity(parent: CargoParent, items: CargoItem[]): CargoCapacityResult {
  const violations: CargoViolation[] = []
  let used = 0

  for (const item of items) {
    if (item.kind === 'custom') {
      used += item.slotCount
    } else {
      const { slots, found } = resolveRefSlotCost(item.ref, item.slotCount)
      if (!found) {
        violations.push({
          kind: 'missing-ref',
          message: `Cargo item "${item.ref}" was not found in the reference data.`,
          details: { ref: item.ref },
        })
      }
      used += slots
    }
  }

  const max = parent.cargoCapacity

  if (used > max) {
    violations.push({
      kind: 'over-capacity',
      message: `Cargo capacity exceeded: ${used} slots used, ${max} available.`,
      details: { used, max },
    })
  }

  return { used, max, violations }
}
