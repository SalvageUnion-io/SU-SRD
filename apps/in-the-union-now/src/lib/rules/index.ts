/**
 * Rule-enforcement utilities barrel (AC-4).
 *
 * Pure TypeScript — no React, no IndexedDB.
 * All functions are synchronous; same input always yields same output.
 *
 * Prerequisites: the salvageunion-reference schemas used by these utilities
 * must be preloaded before the first call:
 *   SalvageUnionReference.preload(['chassis', 'systems', 'modules', 'equipment', 'crawler-tech-levels'])
 */

export { computeMechCapacity } from './capacity'
export {
  PILOT_BASE_HP,
  PILOT_BASE_AP,
  PILOT_BASE_INVENTORY_SLOTS,
  injuryMaxHpPenalty,
  pilotMaxHP,
  pilotMaxAP,
  isPilotDead,
  clampPilotCurrentStats,
  findChassisByRef,
  mechMaxSP,
  mechMaxEP,
  mechMaxHeat,
  mechMaxCargo,
  clampMechCurrentStats,
  unifiedMechConditions,
  crawlerMaxSP,
  clampCrawlerCurrentStats,
} from './derivedStats'
export type { ChassisStats } from './derivedStats'
export { enrichPilotSnapshot } from './pilotSnapshot'
export { computeCrawlerCapacity } from './crawlerCapacity'
export { salvageValueFor, scrapCostFor, tierUpgradeCost } from './scrap'
export { computeCargoCapacity } from './cargo'
export {
  evaluateSoftWarnings,
  evaluatePilotWarnings,
  evaluateMechWarnings,
  PILOT_ABILITY_CAP,
  SALVAGER_ABILITY_CAP,
} from './softWarnings'
export {
  clampHeat,
  reactorOverloadOutcome,
  performHeatCheck,
  performPush,
  defaultRoll,
} from './heatCheck'
export type { Roll, HeatCheckEffect, PushResult } from './heatCheck'

export type {
  // Shared primitives
  TechLevel,
  NumericTechLevel,
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
  SystemSnapshot,
} from './types'

export type {
  CrawlerCapacityInput,
  CrawlerCapacityResult,
  CrawlerCapacityViolation,
} from './crawlerCapacity'
