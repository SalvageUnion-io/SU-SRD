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
import type { MechCapacityResult, MechInput } from './types';
/** A pattern the book prints over its chassis's slots, and where it is printed. */
export type AsPrintedOverflow = {
    /** The chassis's `name`. */
    chassis: string;
    /** The pattern's `name` on that chassis. */
    pattern: string;
    /** Where the pattern is printed: the book and page. */
    cite: string;
};
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
export declare const AS_PRINTED_OVERFLOW: readonly AsPrintedOverflow[];
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
export declare function computeMechCapacity(mech: MechInput): MechCapacityResult;
