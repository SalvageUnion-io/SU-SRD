/**
 * Shared game-rule constants for the in-the-union-now app.
 *
 * All values sourced from the Salvage Union core rules.
 * Reference-data-derived values (e.g. maxAbilities per class) are read
 * directly from `salvageunion-reference` at call sites where needed.
 */

import {
  PILOT_CREATION_ABILITY_PICKS,
  PILOT_CREATION_EQUIPMENT_PICKS,
} from 'salvageunion-reference/rules'

/**
 * Starting ability picks at character creation — exactly 1 per the Pilot Bay
 * ("Your Pilot starts with 1 Ability of your choice", Core Book p.18).
 * Corrected from the previous house-rule 3 (wizard-refresh Phase 3, plan Q1 —
 * the strict-book reading; the Blank create path is the escape hatch).
 * Re-exported from the package predicate module so the budget and the
 * legality gates can never drift.
 */
export const STARTING_ABILITY_BUDGET = PILOT_CREATION_ABILITY_PICKS

/**
 * Starting equipment picks at character creation — exactly 2 per the Pilot
 * Bay ("You may choose two pieces of Tech 1 Pilot Equipment", Core Book
 * p.19). Corrected from the previous house-rule 3 (see above).
 */
export const STARTING_EQUIPMENT_BUDGET = PILOT_CREATION_EQUIPMENT_PICKS
