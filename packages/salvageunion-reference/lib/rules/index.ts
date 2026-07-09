/**
 * Rule-enforcement utilities barrel (ADR-006 — pure rules logic lives here).
 *
 * Pure TypeScript — no React, no IndexedDB, no app dependency.
 * All functions are synchronous; same input always yields same output.
 *
 * Prerequisites: the salvageunion-reference schemas used by these utilities
 * must be preloaded before the first call:
 *   SalvageUnionReference.preload(['chassis', 'systems', 'modules', 'equipment', 'crawler-tech-levels'])
 *
 * Migrated from apps/in-the-union-now/src/lib/rules/ — see ADR-006. Tier 1/2
 * modules (fully portable pure math) live here; Tier 3 modules (deep coupling
 * to full persisted records + app-storage conventions like CargoLot /
 * crypto.randomUUID()) remain app-local in ITUN for now.
 */

export { computeMechCapacity } from './capacity.js'
export { enrichPilotSnapshot } from './pilotSnapshot.js'
export { computeCrawlerCapacity } from './crawlerCapacity.js'
export { salvageValueFor, scrapCostFor, tierUpgradeCost } from './scrap.js'
export { computeCargoCapacity } from './cargo.js'
export {
  evaluateSoftWarnings,
  evaluatePilotWarnings,
  evaluateMechWarnings,
  PILOT_ABILITY_CAP,
  SALVAGER_ABILITY_CAP,
} from './softWarnings.js'
export { isWeaponSystem } from './crawlerSystems.js'
export {
  matchesRef,
  resolveChassisRef,
  resolveSystemRef,
  resolveModuleRef,
  resolveInstalledRef,
  refDisplayName,
} from './resolveRefs.js'
export { pilotDetailWarnings, mechDetailWarnings, crawlerDetailWarnings } from './detailWarnings.js'

export type {
  // Shared primitives
  TechLevel,
  SoftWarning,
  SoftWarningSeverity,
  SoftWarningContext,
  EditSnapshot,
  // Capacity
  MechInput,
  MechSystemSlot,
  MechModuleSlot,
  MechCapacityResult,
  CapacityViolation,
  // Scrap
  ScrapableItem,
  // Cargo
  CargoItem,
  CargoItemRef,
  CargoItemCustom,
  CargoParent,
  CargoCapacityResult,
  CargoViolation,
  // Soft warnings
  PilotSnapshot,
  MechSnapshot,
  AbilityInput,
  AbilityTier,
  SystemSnapshot,
  // Heat Check / Reactor Overload
  Roll,
  ReactorOverloadOutcome,
  HeatCheckResult,
  HeatCheckEffect,
  PushResult,
  // Take Damage / Critical Damage / Critical Injury
  CriticalDamageOutcome,
  CriticalDamageResult,
  CriticalInjuryOutcome,
  CriticalInjuryResult,
  // Mediator tables
  MediatorTableId,
  MediatorRollResult,
} from './types.js'

export type {
  CrawlerCapacityInput,
  CrawlerCapacityResult,
  CrawlerCapacityViolation,
} from './crawlerCapacity.js'
