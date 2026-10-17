/**
 * Heat Check / Reactor Overload rules.
 *
 * Salvage Union Core Book p.233-235 — the central mech combat mechanic.
 *
 * Rules summary:
 * - Heat can never exceed Heat Cap (clamped by `clampHeat`).
 * - A Heat Check triggers when the pilot Pushes, reaches Heat Cap, or starts a
 *   turn at Heat Cap. Roll a d20: if the roll is <= current Heat the reactor
 *   OVERLOADS.
 * - On overload, roll the Reactor Overload Table (another d20):
 *     1     → catastrophic meltdown (mech destroyed)
 *     2-5   → a System is destroyed (player picks which)
 *     6-10  → a Module is destroyed (player picks which)
 *     11-19 → reactor overheat: mech shuts down, becomes Vulnerable, and takes
 *             SP damage equal to current Heat
 *     20    → reactor overdrive: the mech may take any additional action this
 *             turn, or Push its next roll within 10 minutes, for free (p.235)
 * - Push: re-roll a die, +2 Heat (clamped to cap), then immediately a Heat Check.
 *
 * This module is PURE: no React, no IndexedDB, no real randomness. The d20 is
 * injected via a `Roll` function so every function is deterministic in tests.
 * Production callers pass a Randsum-backed `Roll`. `heatCheckPatch` stays
 * app-local in `apps/web/src/lib/rules/heatCheck.ts`: it assembles a
 * `Partial<Mech>` write-through patch, which needs the Cantina's own Zod-derived
 * `Mech` type (ADR-006/ADR-007).
 *
 * The functions here compute the *deterministic* parts of the outcome (clamped
 * heat, SP damage, shutdown/vulnerable/destroyed flags) and report the table
 * band. Marking WHICH System/Module is destroyed (the 2-5 / 6-10 bands) is left
 * to the player via the card status badge — this module never auto-picks.
 */
import type { HeatCheckEffect, PushResult, ReactorOverloadOutcome, Roll } from './types';
/**
 * Clamps a heat value into [0, cap]. Heat can never exceed Heat Cap (rule 1).
 * A negative cap is treated as 0.
 */
export declare function clampHeat(heat: number, cap: number): number;
/**
 * Check whether an action can be activated given current heat and cost.
 * An action is blocked if using it would push heat above the heat cap.
 */
export declare function canActivateAction(currentHeat: number, heatCost: number, heatCap: number): boolean;
/** Heat a Push adds to the Mech (Core Book p.233). */
export declare const PUSH_HEAT = 2;
/**
 * Whether the Mech may Push: not when the Heat gained would take it over its
 * Heat Cap (Core Book p.234 — a Mech with a Heat Capacity of 10 on 9 Heat
 * cannot Push).
 */
export declare function canPush(currentHeat: number, heatCap: number): boolean;
/**
 * Maps a Reactor Overload Table d20 roll to its outcome band (p.235).
 *   1     → meltdown
 *   2-5   → system-destroyed
 *   6-10  → module-destroyed
 *   11-19 → overheat
 *   20    → overdrive
 * Each band is one row of the `Reactor Overload` roll table, which
 * `describeOverloadOutcome` reads for the readout.
 */
export declare function reactorOverloadOutcome(roll: number): ReactorOverloadOutcome;
type HeatCheckInput = {
    /** Current Heat at the moment of the check (already clamped to cap). */
    heat: number;
    /** Current SP — used to apply overheat damage on an 11-19. */
    currentSP: number;
    /** Injectable d20 roller. */
    roll: Roll;
    /** Injectable clock for the recorded timestamp (defaults to () => new Date()). */
    now?: () => Date;
};
/**
 * Performs a single Heat Check (rule 2).
 *
 * Rolls a d20; if roll <= heat the reactor overloads and a second d20 is rolled
 * on the Reactor Overload Table. Returns the deterministic effect. SP damage and
 * shutdown/vulnerable are applied for the 11-19 band; destroyed for roll 1. The
 * 2-5 / 6-10 bands set `requiresPlayerChoice` and leave SP/flags untouched.
 */
export declare function performHeatCheck({ heat, currentSP, roll, now }: HeatCheckInput): HeatCheckEffect;
type PushInput = {
    /** Current Heat before the Push. */
    heat: number;
    /** Heat Cap — the new heat is clamped to this. */
    heatCap: number;
    /** Current SP. */
    currentSP: number;
    /** Injectable d20 roller. */
    roll: Roll;
    /** Injectable clock. */
    now?: () => Date;
};
/**
 * Performs a Push (rule 3): +2 Heat (clamped to cap), then an immediate Heat
 * Check at the new heat. Returns both the new heat and the check effect.
 */
export declare function performPush({ heat, heatCap, currentSP, roll, now }: PushInput): PushResult;
export {};
