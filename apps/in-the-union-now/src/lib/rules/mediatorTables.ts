/**
 * Mediator tables — Reaction / Morale / Retreat rolls (design-review R-5).
 *
 * Moved to packages/salvageunion-reference/lib/rules/mediatorTables.ts
 * (ADR-006). Thin re-export shim — see that module for the implementation.
 */

export {
  MEDIATOR_TABLE_NAMES,
  MEDIATOR_TABLE_LABEL,
  performMediatorRoll,
  describeMediatorRoll,
} from 'salvageunion-reference/rules'
export type { FindRollTable } from 'salvageunion-reference/rules'
