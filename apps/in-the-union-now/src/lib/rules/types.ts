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
  TechLevel,
  MechSystemSlot,
  MechModuleSlot,
  MechInput,
  CapacityViolation,
  MechCapacityResult,
  CargoItemRef,
  CargoItemCustom,
  CargoItem,
  CargoParent,
  CargoViolation,
  CargoCapacityResult,
  ScrapableItem,
  SoftWarningSeverity,
  SoftWarning,
  AbilityTier,
  AbilityInput,
  PilotSnapshot,
  SystemSnapshot,
  MechSnapshot,
  SoftWarningContext,
  EditSnapshot,
} from 'salvageunion-reference'
