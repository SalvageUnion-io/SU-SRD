/**
 * Structural type aliases for the rules module.
 *
 * Moved to packages/salvageunion-reference/lib/rules/types.ts (ADR-006 — pure
 * rules logic lives in the shared data package). This file is a thin
 * re-export shim so the many existing ITUN call sites that import these
 * types from `../../lib/rules/types` (a submodule path, not the rules
 * barrel) keep working unchanged.
 */

export type {
  AbilityInput,
  AbilityTier,
  CapacityViolation,
  CargoCapacityResult,
  CargoItem,
  CargoItemCustom,
  CargoItemRef,
  CargoParent,
  CargoViolation,
  EditSnapshot,
  MechCapacityResult,
  MechInput,
  MechModuleSlot,
  MechSnapshot,
  MechSystemSlot,
  PilotSnapshot,
  ScrapableItem,
  SoftWarning,
  SoftWarningContext,
  SoftWarningSeverity,
  SystemSnapshot,
  TechLevel,
} from 'salvageunion-reference/rules'
