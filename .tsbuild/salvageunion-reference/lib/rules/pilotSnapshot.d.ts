/**
 * Pilot snapshot enrichment for soft-warning evaluation.
 *
 * The `Pilot` type (from the Zod schema) stores `abilities` as `string[]`
 * (slug refs) and the class as `classRef`. The soft-warning system's
 * `PilotSnapshot` expects `AbilityInput[]` — structs carrying the ability's
 * tree, level and tier — plus class tier flags.
 *
 * `enrichPilotSnapshot` resolves all of that from `salvageunion-reference`,
 * so the prerequisite checks in softWarnings.ts (tree order, 6-core gates,
 * one-Legendary, Salvager cap) receive the data they need. Wizards call this
 * pre-save on both the stored pilot (before) and the form state (after).
 *
 * All functions are pure — no side effects, no async, no React.
 * Prerequisite: SalvageUnionReference must be preloaded with 'abilities' and
 * 'classes' before calling (the app root preloads 'all').
 */
import type { PilotSnapshot } from './types';
/**
 * Enrich a `Pilot`-shaped object (or wizard form state) into a `PilotSnapshot`
 * suitable for `evaluateSoftWarnings`. Resolves each ability's tree/level and
 * classifies its tier; resolves the class to set `isSalvager`/`classTier`.
 *
 * Unknown ability refs survive as bare `{ ref }` entries — the warning checks
 * skip them rather than fabricating violations.
 */
export declare function enrichPilotSnapshot(pilot: {
    abilities: string[];
    classRef?: string;
}): PilotSnapshot;
