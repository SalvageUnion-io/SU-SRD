/**
 * Mech capacity rule enforcement (REQ-009).
 *
 * Computes slot usage and surfaces violations. All operations are synchronous
 * and pure — same input always yields same output. No React, no IndexedDB.
 *
 * Chassis slot caps come from `salvageunion-reference` via the lazy-loaded
 * `SalvageUnionReference.Chassis` model. Callers must ensure the relevant
 * schemas are preloaded (e.g. `SalvageUnionReference.preload(['chassis',
 * 'systems', 'modules'])`) before the first call to `computeMechCapacity`.
 */

import { resolveChassisRef, resolveModuleRef, resolveSystemRef } from './resolveRefs.js'
import type { CapacityViolation, MechCapacityResult, MechInput } from './types.js'

/**
 * Look up the slot cost of a system by ref (slug; legacy name/id tolerated).
 * Returns the canonical `slotsRequired` from the dataset, or 1 as fallback
 * if the system is not found (to still count it against the total).
 */
function resolveSystemSlotCost(ref: string, slotCostOverride?: number): number {
  if (slotCostOverride !== undefined) return slotCostOverride
  return resolveSystemRef(ref)?.slotsRequired ?? 1
}

/**
 * Look up the slot cost of a module by ref (slug; legacy name/id tolerated).
 */
function resolveModuleSlotCost(ref: string, slotCostOverride?: number): number {
  if (slotCostOverride !== undefined) return slotCostOverride
  return resolveModuleRef(ref)?.slotsRequired ?? 1
}

/**
 * Compute mech capacity from a `MechInput` and return slot usage + violations.
 *
 * Violation kinds:
 * - `chassis-not-found` — the `chassisRef` doesn't resolve to a chassis entry
 * - `system-over-slots` — total system slot usage exceeds the chassis cap
 * - `module-over-slots` — total module slot usage exceeds the chassis cap
 * - `system-requires-chassis` — (reserved for future chassis-locked system checks)
 *
 * When `chassis-not-found` is present, `systemSlotsMax` and `moduleSlotsMax`
 * are both 0 and all slot violations are suppressed (can't enforce without a cap).
 */
export function computeMechCapacity(mech: MechInput): MechCapacityResult {
  const violations: CapacityViolation[] = []

  // Resolve chassis
  const chassis = resolveChassisRef(mech.chassisRef)

  if (!chassis) {
    violations.push({
      kind: 'chassis-not-found',
      message: `Chassis "${mech.chassisRef}" was not found in the reference data.`,
      details: { chassisRef: mech.chassisRef },
    })
    // Return early — can't compute caps without a chassis
    return {
      systemSlotsUsed: mech.systems.reduce(
        (sum, s) => sum + resolveSystemSlotCost(s.ref, s.slotCost),
        0
      ),
      systemSlotsMax: 0,
      moduleSlotsUsed: mech.modules.reduce(
        (sum, m) => sum + resolveModuleSlotCost(m.ref, m.slotCost),
        0
      ),
      moduleSlotsMax: 0,
      violations,
    }
  }

  const systemSlotsMax = chassis.systemSlots ?? 0
  const moduleSlotsMax = chassis.moduleSlots ?? 0

  const systemSlotsUsed = mech.systems.reduce(
    (sum, s) => sum + resolveSystemSlotCost(s.ref, s.slotCost),
    0
  )

  const moduleSlotsUsed = mech.modules.reduce(
    (sum, m) => sum + resolveModuleSlotCost(m.ref, m.slotCost),
    0
  )

  if (systemSlotsUsed > systemSlotsMax) {
    violations.push({
      kind: 'system-over-slots',
      message: `System slots exceeded: ${systemSlotsUsed} used, ${systemSlotsMax} available.`,
      details: { used: systemSlotsUsed, max: systemSlotsMax },
    })
  }

  if (moduleSlotsUsed > moduleSlotsMax) {
    violations.push({
      kind: 'module-over-slots',
      message: `Module slots exceeded: ${moduleSlotsUsed} used, ${moduleSlotsMax} available.`,
      details: { used: moduleSlotsUsed, max: moduleSlotsMax },
    })
  }

  return { systemSlotsUsed, systemSlotsMax, moduleSlotsUsed, moduleSlotsMax, violations }
}
