/**
 * Core Mechanic d20.
 *
 * Salvage Union Core Book p.232 / Quick Ref 2.0 p.1 — the game's single
 * resolution roll. Roll a d20 and read the band:
 *
 *   20    → Nailed it       (outstanding success + a bonus of your choice)
 *   11-19 → Success         (goal achieved without compromise)
 *   6-10  → Tough Choice    (success at a cost — Setback attached)
 *   2-5   → Failure         (failed; Setback of the Mediator's choice)
 *   1     → Cascade Failure (severe consequence of the Mediator's choice)
 *
 * The app's value is the band text + Push bookkeeping, not the RNG: rolling
 * is component-state only (never persisted), while a mech Push routes the +2
 * Heat and Heat Check through the store per ADR-007 (mechanical bookkeeping
 * auto-applies; the player marks any destroyed System/Module by hand).
 *
 * This module is PURE: no React, no store, no real randomness — the d20 is
 * injected via the shared `Roll` type so tests are deterministic. The reads of
 * the catalog are {@link coreRollBandLabel} and {@link describeOverloadOutcome}:
 * a band's title and a Reactor Overload row are the roll tables' own text, so
 * they need `roll-tables` preloaded.
 */
import type { HeatCheckEffect, Roll } from './types';
export type CoreRollBand = 'nailed' | 'success' | 'tough' | 'failure' | 'cascade';
export type CoreRollBandInfo = {
    band: CoreRollBand;
    /**
     * The band's lowest face: where it starts on the Core Mechanic table. The
     * title is read from the table there by {@link coreRollBandLabel}.
     */
    low: number;
    /** The d20 range, e.g. '11–19'. */
    range: string;
    /** One-line rules summary (Quick Ref 2.0 wording, condensed). */
    summary: string;
};
/** Band metadata in table order (20 → 1), for readouts and legends. */
export declare const CORE_ROLL_BANDS: Record<CoreRollBand, CoreRollBandInfo>;
/**
 * A band's title, as the Core Mechanic roll table prints it (Workshop Manual
 * p.232: "Nailed it", "Success", "Tough Choice", "Failure", "Cascade Failure").
 * Read from the table's data, so the readout and the table cannot disagree.
 *
 * Preload requirement: `roll-tables`.
 */
export declare function coreRollBandLabel(band: CoreRollBand): string;
/**
 * Maps a Core Mechanic d20 roll to its band (p.232). Rolls are clamped
 * into [1, 20] defensively — modifiers never move a roll off the table.
 */
export declare function coreRollBand(roll: number): CoreRollBand;
export type CoreRollResult = {
    /** The d20 face rolled. */
    roll: number;
    band: CoreRollBand;
};
/** Rolls the Core Mechanic d20 via the injected roller and reads the band. */
export declare function performCoreRoll(roll: Roll): CoreRollResult;
/**
 * The Heat Check outcome sentence — everything after the `… — ` in a Heat Check
 * readout. The Dashboard's `describeHeatCheck` and this module's
 * `describePushOutcome` differ only in the head they prefix, so the tail lives
 * here and the FAB, the sheet body and the Dashboard band can never drift
 * apart.
 *
 * An overload prints the rolled row of the Reactor Overload table (Core Book
 * p.235) — its title and text, verbatim — then the app's bookkeeping, so the
 * readout and the book cannot disagree.
 *
 * Preload requirement: `roll-tables`.
 */
export declare function describeOverloadOutcome(result: HeatCheckEffect['result']): string;
/**
 * One-line readout for a mech Push's Heat Check outcome, surfaced next to the
 * re-rolled d20 in the quick-roll log. Mirrors HeatCheckControl's wording so
 * the FAB and the sheet-body readout never disagree.
 */
export declare function describePushOutcome(nextHeat: number, effect: HeatCheckEffect): string;
