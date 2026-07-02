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
  installedStatBonus,
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
export {
  mechEffectiveDamage,
  applyMechDamage,
  criticalDamageOutcome,
  performCriticalDamage,
  pilotEffectiveDamage,
  applyPilotDamage,
  criticalInjuryOutcome,
  performCriticalInjury,
} from './takeDamage'
export type {
  DamageKind,
  MechDamageEffect,
  PilotDamageEffect,
  CriticalDamageEffect,
  CriticalInjuryEffect,
} from './takeDamage'
export {
  DOWNTIME_STEP_KEYS,
  DOWNTIME_UPKEEP_SCRAP,
  CHASSIS_DAMAGED_CONDITION,
  NEVER_RECHARGE_EQUIPMENT,
  allDowntimeSteps,
  resolveDowntimeScope,
  medBayStatus,
  repairableItems,
  healableInjuries,
  downtimeMechPatch,
  downtimePilotPatch,
} from './downtime'
export type {
  DowntimeStepKey,
  DowntimeSteps,
  DowntimeScope,
  MedBayStatus,
  RepairableItems,
  HealableInjuries,
} from './downtime'
export {
  AREA_SALVAGE_DEFAULT_SUPPLY,
  AREA_SALVAGE_LABEL,
  MECH_SALVAGE_LABEL,
  EMPTY_CLAIM,
  areaSalvageBand,
  performAreaSalvage,
  areaJackpotClaim,
  claimAllows,
  takeFromClaim,
  claimExhausted,
  mechSalvageBand,
  halfSalvageScrap,
  performMechSalvage,
  damagedSalvageLot,
} from './salvage'
export type {
  AreaSalvageBand,
  AreaSalvageResult,
  SalvageClaim,
  SalvageTakeKind,
  MechSalvageBand,
  MechSalvageResult,
  WreckChassis,
  SalvagedItem,
} from './salvage'
export {
  UPKEEP_SCRAP,
  DETERIORATION_SP_LOSS,
  TRADING_AVAILABILITY_LABEL,
  poolAvailableAtOrAbove,
  drawFromPool,
  upkeepShortfall,
  payUpkeep,
  contributeToUpgradePool,
  deteriorationOutcome,
  performDeterioration,
  crawlerUpgradeQuote,
  scrapValue,
  exchangeStep,
  convertedCount,
  convertScrap,
  tradingAvailability,
  tradingSourceTl,
  performTradingRoll,
  bayGate,
} from './crawlerEconomy'
export type {
  PoolDraw,
  UpkeepPayment,
  DeteriorationOutcome,
  DeteriorationEffect,
  CrawlerUpgradeQuote,
  TradingAvailability,
  TradingRollResult,
  BayGate,
} from './crawlerEconomy'
export { CRAFTING_BAY, craftableAtTl, craftQuote, craftedLot } from './crafting'
export type { CraftableItem, CraftQuote } from './crafting'
export {
  mechScrapComponents,
  scrapMechBreakdown,
  depositScrapDeposits,
  handOffCargo,
} from './scrapMech'
export type {
  ScrapMechComponent,
  ScrapMechComponentKind,
  ScrapMechSkip,
  ScrapMechSkipReason,
  ScrapMechBreakdown,
  ScrapMechInput,
} from './scrapMech'

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
  SystemSnapshot,
} from './types'

export type {
  CrawlerCapacityInput,
  CrawlerCapacityResult,
  CrawlerCapacityViolation,
} from './crawlerCapacity'

export {
  MEDIATOR_TABLE_NAMES,
  MEDIATOR_TABLE_LABEL,
  performMediatorRoll,
  describeMediatorRoll,
} from './mediatorTables'
export type { FindRollTable } from './mediatorTables'
