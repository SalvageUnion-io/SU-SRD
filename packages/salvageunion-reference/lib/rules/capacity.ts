/**
 * Mech capacity rule enforcement.
 *
 * Computes slot usage and surfaces violations. All operations are synchronous
 * and pure — same input always yields same output. No React, no IndexedDB.
 *
 * Chassis slot caps come from `salvageunion-reference` via the lazy-loaded
 * `SalvageUnionReference.Chassis` model. Callers must ensure the relevant
 * schemas are preloaded (e.g. `SalvageUnionReference.preload(['chassis',
 * 'systems', 'modules'])`) before the first call to `computeMechCapacity`.
 */

import { nameToSlug } from '../nameToSlug'
import type { SURefChassis } from '../schemas/index'
import { resolveChassisRef, resolveModuleRef, resolveSystemRef } from './resolveRefs'
import type { CapacityViolation, MechCapacityResult, MechInput } from './types'

/** A pattern the book prints over its chassis's slots, and where it is printed. */
export type AsPrintedOverflow = {
  /** The chassis's `name`. */
  chassis: string
  /** The pattern's `name` on that chassis. */
  pattern: string
  /** Where the pattern is printed: the book and page. */
  cite: string
}

const MM_GOLIATH = 'Mech Monday Goliath Patterns'
const MM_BOBCAT = 'Mech Monday Bobcat Patterns'
const SS_PARTS = 'Salvage Union Starter Set, Parts Catalogue'
const WM = 'Salvage Union Workshop Manual'

/**
 * Every printed pattern whose loadout, summed by the book's own `slotsRequired`,
 * does not fit its chassis (or one of its heads). These are the book's numbers,
 * not data errors: the data keeps each chassis's printed slots and each item's
 * printed slot cost, and `patternFit.test.ts` fails on any overflow not listed
 * here, and on any entry listed here that fits.
 *
 * The Goliath and Bobcat entries share one cause. The Starter Set prints the
 * Goliath with 18 System Slots (Parts Catalogue p.24) and the Bobcat with 13
 * (p.10), but the Mech Monday sheets the patterns were drafted on print 20
 * (Mech Monday Goliath Template p.1) and 14 (Mech Monday Bobcat Patterns p.2),
 * and every pattern for both is sized to those. The slot costs are not the
 * cause: the Parts Catalogue prints the same costs as the Workshop Manual
 * (30mm Autocannon 5 and Riveting Gun 3 on p.53, Blue Mining Laser 7 on p.54,
 * Cargo Pod 1 on p.48). The data follows the Starter Set.
 *
 * The Cerberus is modelled with its three heads (Rainmaker p.72–73), and TAC-OS
 * places each item on the head the book does (p.75). Kyrios and Phren fit;
 * Morphos carries 13 of its 12 System Slots and the chassis 6 of its 5.
 */
export const AS_PRINTED_OVERFLOW: readonly AsPrintedOverflow[] = [
  { chassis: 'Mule', pattern: 'Appleseed', cite: 'Mech Monday Mule Patterns p.1' },
  { chassis: 'Mule', pattern: 'Party Bus', cite: 'Mech Monday Mule Patterns p.6' },
  { chassis: 'Mazona', pattern: 'Bomblebee', cite: 'The Hive p.1' },
  { chassis: 'Scrapper', pattern: 'Sakura', cite: `${WM} p.105` },
  { chassis: 'Spectrum', pattern: 'Hedgehog Dilemma', cite: 'Mech Monday Spectrum Patterns p.3' },
  { chassis: 'Goliath', pattern: 'Scrapjack', cite: `${SS_PARTS} p.25` },
  { chassis: 'Goliath', pattern: 'Endeavour', cite: `${SS_PARTS} p.25` },
  { chassis: 'Goliath', pattern: 'Bio-Hunter', cite: `${SS_PARTS} p.25` },
  { chassis: 'Goliath', pattern: 'Ant', cite: `${MM_GOLIATH} p.1` },
  { chassis: 'Goliath', pattern: 'Atomiser', cite: `${MM_GOLIATH} p.2` },
  { chassis: 'Goliath', pattern: 'Autogenous', cite: `${MM_GOLIATH} p.3` },
  { chassis: 'Goliath', pattern: 'Doss', cite: `${MM_GOLIATH} p.4` },
  { chassis: 'Goliath', pattern: 'Firefly', cite: `${MM_GOLIATH} p.5` },
  { chassis: 'Goliath', pattern: 'Gridiron Webslinger', cite: `${MM_GOLIATH} p.6` },
  { chassis: 'Goliath', pattern: 'Hellion', cite: `${MM_GOLIATH} p.7` },
  { chassis: 'Goliath', pattern: 'King Crab', cite: `${MM_GOLIATH} p.8` },
  { chassis: 'Goliath', pattern: 'Limpet Mine', cite: `${MM_GOLIATH} p.9` },
  { chassis: 'Goliath', pattern: 'Orthrus', cite: `${MM_GOLIATH} p.10` },
  { chassis: 'Goliath', pattern: 'Picket', cite: `${MM_GOLIATH} p.11` },
  { chassis: 'Goliath', pattern: 'Riptide', cite: `${MM_GOLIATH} p.12` },
  { chassis: 'Goliath', pattern: 'Tanks-A-Lot', cite: `${MM_GOLIATH} p.13` },
  { chassis: 'Goliath', pattern: 'Tollmaster', cite: `${MM_GOLIATH} p.14` },
  { chassis: 'Kraken', pattern: 'Blackbeard', cite: `${WM} p.119` },
  { chassis: 'Kraken', pattern: 'Saboteur', cite: `${WM} p.119` },
  { chassis: 'Kraken', pattern: 'Aegean', cite: `${WM} p.119` },
  { chassis: 'Mirrorball', pattern: 'Junker', cite: `${WM} p.123` },
  { chassis: 'Atlas', pattern: 'Thunder Storm', cite: `${WM} p.125` },
  { chassis: 'Atlas', pattern: 'Evantis', cite: `${WM} p.125` },
  { chassis: 'Atlas', pattern: 'Chauffeur', cite: `${SS_PARTS} p.39` },
  { chassis: 'Solo', pattern: 'Smuggler', cite: `${WM} p.135` },
  { chassis: 'Colossus', pattern: 'Evantis', cite: `${WM} p.141` },
  { chassis: 'Neura-Phage', pattern: 'Ascension', cite: `${WM} p.153` },
  { chassis: 'Iron Wyrm', pattern: 'M.A.D.', cite: `${WM} p.155` },
  { chassis: 'Cranium Bio-Mech', pattern: 'Probe', cite: 'We Were Here First! p.77' },
  { chassis: 'Pioneer', pattern: 'Deerstalker', cite: 'False Flag p.59' },
  { chassis: 'Parasite', pattern: 'Stefanus', cite: 'False Flag p.61' },
  { chassis: 'Stolas', pattern: 'B', cite: 'Rainmaker p.63' },
  { chassis: 'Cerberus', pattern: 'TAC-OS', cite: 'Rainmaker p.75' },
  { chassis: 'Bobcat', pattern: 'Manic Miner', cite: `${SS_PARTS} p.11` },
  { chassis: 'Bobcat', pattern: 'Bill E', cite: `${MM_BOBCAT} p.1` },
  { chassis: 'Bobcat', pattern: 'Court Cat', cite: `${MM_BOBCAT} p.2` },
  { chassis: 'Bobcat', pattern: 'Guano', cite: `${MM_BOBCAT} p.3` },
  { chassis: 'Bobcat', pattern: 'Mag-Train', cite: `${MM_BOBCAT} p.4` },
  { chassis: 'Bobcat', pattern: 'Magic Bus', cite: `${MM_BOBCAT} p.5` },
  { chassis: 'Bobcat', pattern: 'Nyaa~', cite: `${MM_BOBCAT} p.6` },
  { chassis: 'Bobcat', pattern: 'Osiris', cite: `${MM_BOBCAT} p.7` },
]

/**
 * Look up the slot cost of a system by its slug.
 * Returns the canonical `slotsRequired` from the dataset, or 1 as fallback
 * if the system is not found (to still count it against the total).
 */
function resolveSystemSlotCost(ref: string, slotCostOverride?: number): number {
  if (slotCostOverride !== undefined) return slotCostOverride
  return resolveSystemRef(ref)?.slotsRequired ?? 1
}

/**
 * Look up the slot cost of a module by its slug.
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
 *
 * When `chassis-not-found` is present, `systemSlotsMax` and `moduleSlotsMax`
 * are both 0 and all slot violations are suppressed (can't enforce without a cap).
 *
 * A chassis with `heads` adds each head's slots to its own. A loadout that is
 * exactly a pattern in `AS_PRINTED_OVERFLOW` raises no over-slot violation: it
 * returns `asPrinted` (the pattern and its cite) instead, so a mech built from
 * the book reads as the book rather than as an error.
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

  // A multi-headed chassis mounts on its heads as well as on itself, and a
  // mech's loadout does not record which, so the budget is all of them.
  const heads = chassis.heads ?? []
  const systemSlotsMax = heads.reduce((sum, h) => sum + h.systemSlots, chassis.systemSlots ?? 0)
  const moduleSlotsMax = heads.reduce((sum, h) => sum + h.moduleSlots, chassis.moduleSlots ?? 0)

  const systemSlotsUsed = mech.systems.reduce(
    (sum, s) => sum + resolveSystemSlotCost(s.ref, s.slotCost),
    0
  )

  const moduleSlotsUsed = mech.modules.reduce(
    (sum, m) => sum + resolveModuleSlotCost(m.ref, m.slotCost),
    0
  )

  const asPrinted = asPrintedOverflowOf(chassis, mech)
  if (asPrinted) {
    return {
      systemSlotsUsed,
      systemSlotsMax,
      moduleSlotsUsed,
      moduleSlotsMax,
      violations,
      asPrinted: { pattern: asPrinted.pattern, cite: asPrinted.cite },
    }
  }

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

/** A pattern list's slugs, one per copy (`count` expanded), sorted. */
function patternRefs(items: SURefChassis['patterns'][number]['systems']): string[] {
  return items.flatMap((item) => Array<string>(item.count ?? 1).fill(nameToSlug(item.name))).sort()
}

function sameRefs(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((ref, i) => ref === b[i])
}

/** The `AS_PRINTED_OVERFLOW` entry whose printed loadout this mech's is, if any. */
function asPrintedOverflowOf(
  chassis: SURefChassis,
  mech: MechInput
): AsPrintedOverflow | undefined {
  const entries = AS_PRINTED_OVERFLOW.filter((entry) => entry.chassis === chassis.name)
  if (entries.length === 0) return undefined
  const systems = mech.systems.map((s) => s.ref).sort()
  const modules = mech.modules.map((m) => m.ref).sort()
  return entries.find((entry) => {
    const pattern = chassis.patterns.find((p) => p.name === entry.pattern)
    return (
      pattern !== undefined &&
      sameRefs(patternRefs(pattern.systems), systems) &&
      sameRefs(patternRefs(pattern.modules), modules)
    )
  })
}
