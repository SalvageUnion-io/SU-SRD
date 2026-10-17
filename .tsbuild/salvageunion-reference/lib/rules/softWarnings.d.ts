/**
 * Soft-warning rule evaluation.
 *
 * Soft warnings are non-blocking rule violations surfaced at save time. The
 * user sees them in a confirm-and-proceed dialog and may dismiss them. They do
 * not prevent saving — they inform and protect against common mistakes.
 *
 * This module is intentionally kept to documented cases only.
 *
 * All functions are pure — no side effects, no async, no React.
 */
import type { EditSnapshot, MechSnapshot, PilotSnapshot, SoftWarning, SoftWarningContext } from './types';
/**
 * The pilot ability soft cap: 10 abilities, 12 for Salvager.
 * The schema does not cap the array — exceeding the rules cap is a soft
 * warning, never a parse failure or a blocked save.
 *
 * These are the FALLBACK, not the source. Every class record carries its
 * own `maxAbilities`, and `PilotSnapshot.maxAbilities` passes it through — so a
 * resolvable class is capped by its own data. They stay for a snapshot whose
 * class did not resolve, and because they are public API.
 */
export declare const PILOT_ABILITY_CAP = 10;
export declare const SALVAGER_ABILITY_CAP = 12;
/**
 * Evaluate soft warnings for a pilot edit.
 *
 * Documented cases (all advisory, never blocking):
 * - Tree order violated (level n taken without the levels below it)
 * - Advanced/Hybrid ability without the 6-core gate
 * - Legendary ability without 6 core + 3 advanced; more than one Legendary
 * - Class switched to Advanced/Hybrid without the 6-core gate
 * - Ability count beyond the rules cap (10 / Salvager 12)
 *
 * Returns an empty array when no warnings apply.
 */
export declare function evaluatePilotWarnings(snapshot: EditSnapshot<PilotSnapshot>, context: SoftWarningContext): SoftWarning[];
/**
 * Evaluate soft warnings for a mech edit.
 *
 * Documented cases:
 * - A system that another system depends on is being removed
 * - Tech level is being downgraded (optionally: without a scrap refund)
 *
 * Returns an empty array when no warnings apply.
 */
export declare function evaluateMechWarnings(snapshot: EditSnapshot<MechSnapshot>, context: SoftWarningContext): SoftWarning[];
/**
 * Unified entry point for soft-warning evaluation.
 *
 * Dispatches to the appropriate entity-specific evaluator based on
 * `context.entityType`. For 'pilot', `before`/`after` must be `PilotSnapshot`.
 * For 'mech', they must be `MechSnapshot`. For 'crawler', only the
 * tech-level downgrade check applies (crawler-specific rules beyond it are not
 * enforced yet).
 *
 * When `entityType` is 'crawler', pass any object satisfying `MechSnapshot`
 * (only the `techLevel` field is read; `systems` can be an empty array).
 *
 * Returns an empty array when no warnings apply.
 */
export declare function evaluateSoftWarnings(before: PilotSnapshot | MechSnapshot, after: PilotSnapshot | MechSnapshot, context: SoftWarningContext): SoftWarning[];
