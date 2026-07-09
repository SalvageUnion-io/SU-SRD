/**
 * Core Mechanic d20 (design review R-6/U-3).
 *
 * Moved to packages/salvageunion-reference/lib/rules/coreMechanic.ts
 * (ADR-006). Thin re-export shim — see that module for the implementation.
 */

export {
  CORE_ROLL_BANDS,
  coreRollBand,
  performCoreRoll,
  describePushOutcome,
} from 'salvageunion-reference'
export type { CoreRollBand, CoreRollBandInfo, CoreRollResult } from 'salvageunion-reference'
