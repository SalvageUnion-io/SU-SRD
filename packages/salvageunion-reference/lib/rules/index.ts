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
 * Migrated from apps/itun/src/lib/rules/ — see ADR-006. Tier 1/2
 * modules (fully portable pure math) live here; Tier 3 modules (deep coupling
 * to full persisted records + app-storage conventions like CargoLot /
 * crypto.randomUUID()) remain app-local in ITUN for now.
 */

export { computeMechCapacity } from './capacity.js'
export {
  PILOT_CREATION_ABILITY_PICKS,
  PILOT_CREATION_EQUIPMENT_PICKS,
  MECH_CREATION_SCRAP_CAP,
  CRAWLER_CREATION_TECH_LEVEL,
  CRAWLER_CREATION_MIN_WEAPONS,
  isLegalCreationClass,
  isLegalCreationAbility,
  legalCreationAbilities,
  isLegalCreationEquipment,
  isLegalCreationChassis,
  isLegalCreationSystem,
  isLegalCreationModule,
  isLegalCreationCrawlerWeapon,
  isLegalStartingPattern,
  legalStartingPatterns,
  mechCreationBudget,
  crawlerWeaponSlots,
  crawlerMaxSpBonus,
  isCrawlerWeaponPickComplete,
  pilotAbilityPicksRemaining,
  pilotEquipmentPicksRemaining,
  isPilotAbilityPickComplete,
  isPilotEquipmentPickComplete,
} from './creation.js'
export type {
  CreationCoreTrees,
  CreationAbilityInput,
  CreationEquipmentInput,
  CreationPatternInput,
  CrawlerMutationInput,
  MechCreationBudget,
  MechCreationBudgetInput,
  MechCreationLoadoutEntry,
} from './creation.js'
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
  resolveCatalogChoiceEntities,
  isSchemaOnlyCatalogChoice,
} from './choiceCatalog.js'
export {
  matchesRef,
  resolveChassisRef,
  resolveSystemRef,
  resolveModuleRef,
  resolveInstalledRef,
  refDisplayName,
} from './resolveRefs.js'
export { pilotDetailWarnings, mechDetailWarnings, crawlerDetailWarnings } from './detailWarnings.js'
export {
  clampHeat,
  canActivateAction,
  reactorOverloadOutcome,
  performHeatCheck,
  performPush,
} from './heatCheck.js'
export {
  CORE_ROLL_BANDS,
  coreRollBand,
  performCoreRoll,
  describePushOutcome,
} from './coreMechanic.js'
export type { CoreRollBand, CoreRollBandInfo, CoreRollResult } from './coreMechanic.js'
export {
  applySpDamage,
  mechEffectiveDamage,
  applyMechDamage,
  criticalDamageOutcome,
  performCriticalDamage,
  pilotEffectiveDamage,
  applyPilotDamage,
  criticalInjuryOutcome,
  performCriticalInjury,
} from './takeDamage.js'
export type {
  DamageKind,
  MechDamageInput,
  MechDamageEffect,
  PilotDamageInput,
  PilotDamageEffect,
  CriticalDamageEffect,
  CriticalInjuryEffect,
} from './takeDamage.js'
export {
  PILOT_BASE_HP,
  PILOT_BASE_AP,
  PILOT_BASE_INVENTORY_SLOTS,
  injuryMaxHpPenalty,
  pilotMaxHP,
  pilotMaxAP,
  isPilotDead,
  clampPilotCurrentStats,
  installedStatBonus,
  mechMaxSP,
  mechMaxEP,
  mechMaxHeat,
  mechMaxCargo,
  clampMechCurrentStats,
  unifiedMechConditions,
  crawlerMaxSP,
  crawlerMaxSPParts,
  mechMaxSPParts,
  mechMaxEPParts,
  mechMaxHeatParts,
  mechMaxCargoParts,
  pilotMaxHPParts,
  pilotMaxAPParts,
  clampCrawlerCurrentStats,
} from './derivedStats.js'
export type { ChassisStats, CrawlerMaxSPParts, StatBreakdown } from './derivedStats.js'
export {
  MEDIATOR_TABLE_NAMES,
  MEDIATOR_TABLE_LABEL,
  performMediatorRoll,
  describeMediatorRoll,
} from './mediatorTables.js'
export type { FindRollTable } from './mediatorTables.js'

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
