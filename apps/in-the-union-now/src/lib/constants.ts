/**
 * Shared game-rule constants for the in-the-union-now app.
 *
 * All values sourced from the Salvage Union core rules.
 * Reference-data-derived values (e.g. maxAbilities per class) are read
 * directly from `salvageunion-reference` at call sites where needed.
 */

/**
 * Starting ability slots at character creation per Salvage Union core rules.
 * Base classes expose `maxAbilities` in salvageunion-reference; when present,
 * prefer that value — this constant is the fallback for classes that do not.
 */
export const STARTING_ABILITY_BUDGET = 3

/**
 * Starting equipment slots at character creation per Salvage Union core rules.
 */
export const STARTING_EQUIPMENT_BUDGET = 3
