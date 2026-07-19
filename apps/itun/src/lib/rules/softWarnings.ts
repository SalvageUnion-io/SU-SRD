/**
 * Soft-warning rule evaluation (REQ-012).
 *
 * Moved to packages/salvageunion-reference/lib/rules/softWarnings.ts
 * (ADR-006). Thin re-export shim — see that module for the implementation.
 */

export {
  evaluateSoftWarnings,
  evaluatePilotWarnings,
  evaluateMechWarnings,
  PILOT_ABILITY_CAP,
  SALVAGER_ABILITY_CAP,
} from 'salvageunion-reference/rules'
