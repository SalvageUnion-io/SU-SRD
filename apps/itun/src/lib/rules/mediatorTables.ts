/**
 * Mediator tables — Reaction / Morale / Retreat rolls (design-review R-5).
 *
 * Moved to packages/salvageunion-reference/lib/rules/mediatorTables.ts
 * (ADR-006). Thin re-export shim — see that module for the implementation.
 */

export type { FindRollTable } from 'salvageunion-reference/rules'
export {
  describeMediatorRoll,
  MEDIATOR_TABLE_LABEL,
  MEDIATOR_TABLE_NAMES,
  performMediatorRoll,
} from 'salvageunion-reference/rules'
