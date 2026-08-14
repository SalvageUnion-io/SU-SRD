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

export type {
  AdvancementClassInput,
  AdvancementDataset,
  AdvancementOption,
  AdvancementRequirementInput,
  AdvancementTrees,
  OriginInference,
  OriginInferenceState,
} from './advancement.js'
export {
  advancementOptionsFor,
  gateTreeFor,
  hybridGrantedTrees,
  inferOriginClass,
  originsForHybrid,
  resolveAdvancementTrees,
} from './advancement.js'
export {
  liveAdvancementDataset,
  offeredAbilityTrees,
  toAdvancementClass,
} from './advancementDataset.js'
export { computeMechCapacity } from './capacity.js'
export {
  isSchemaOnlyCatalogChoice,
  resolveCatalogChoiceEntities,
} from './choiceCatalog.js'
export type {
  ContributionAmount,
  ContributionStat,
  ContributionTarget,
  DeclaredContribution,
  ResolvedContribution,
} from './contributions.js'
export {
  abilityContributions,
  resolveAmount,
  sumContributions,
} from './contributions.js'
export type { CoreRollBand, CoreRollBandInfo, CoreRollResult } from './coreMechanic.js'
export {
  CORE_ROLL_BANDS,
  coreRollBand,
  describeOverloadOutcome,
  describePushOutcome,
  performCoreRoll,
} from './coreMechanic.js'
export type {
  CrawlerCapacityInput,
  CrawlerCapacityResult,
  CrawlerCapacityViolation,
} from './crawlerCapacity.js'
export { computeCrawlerCapacity } from './crawlerCapacity.js'
export { isWeaponSystem } from './crawlerSystems.js'
export type {
  CrawlerMutationInput,
  CreationAbilityInput,
  CreationCoreTrees,
  CreationEquipmentInput,
  CreationPatternInput,
  MechCreationBudget,
  MechCreationBudgetInput,
  MechCreationLoadoutEntry,
} from './creation.js'
export {
  CRAWLER_CREATION_MIN_WEAPONS,
  CRAWLER_CREATION_TECH_LEVEL,
  crawlerMaxSpBonus,
  crawlerWeaponSlots,
  isCrawlerWeaponPickComplete,
  isLegalCreationAbility,
  isLegalCreationChassis,
  isLegalCreationClass,
  isLegalCreationCrawlerWeapon,
  isLegalCreationEquipment,
  isLegalCreationModule,
  isLegalCreationSystem,
  isLegalStartingPattern,
  isPilotAbilityPickComplete,
  isPilotEquipmentPickComplete,
  legalCreationAbilities,
  legalStartingPatterns,
  MECH_CREATION_SCRAP_CAP,
  mechCreationBudget,
  PILOT_CREATION_ABILITY_PICKS,
  PILOT_CREATION_EQUIPMENT_PICKS,
  pilotEquipmentPicksRemaining,
} from './creation.js'
export type { ChassisStats, CrawlerMaxSPParts, StatBreakdown } from './derivedStats.js'
export {
  clampCrawlerCurrentStats,
  clampMechCurrentStats,
  clampPilotCurrentStats,
  crawlerMaxSP,
  crawlerMaxSPParts,
  injuryMaxHpPenalty,
  isPilotDead,
  mechMaxCargo,
  mechMaxCargoParts,
  mechMaxEP,
  mechMaxEPParts,
  mechMaxHeat,
  mechMaxHeatParts,
  mechMaxSP,
  mechMaxSPParts,
  PILOT_BASE_AP,
  PILOT_BASE_HP,
  PILOT_BASE_INVENTORY_SLOTS,
  pilotMaxAP,
  pilotMaxAPParts,
  pilotMaxHP,
  pilotMaxHPParts,
  pilotMaxInventorySlots,
  pilotMaxInventorySlotsParts,
  resolveGauge,
  resolvePool,
  resolvePoolStart,
  unifiedMechConditions,
} from './derivedStats.js'
export {
  canActivateAction,
  clampHeat,
  performHeatCheck,
  performPush,
  reactorOverloadOutcome,
} from './heatCheck.js'
export type { FindRollTable } from './mediatorTables.js'
export {
  describeMediatorRoll,
  MEDIATOR_TABLE_LABEL,
  MEDIATOR_TABLE_NAMES,
  performMediatorRoll,
} from './mediatorTables.js'
export { enrichPilotSnapshot } from './pilotSnapshot.js'
export {
  matchesRef,
  resolveActionRef,
  resolveChassisRef,
  resolveClassRef,
  resolveCrawlerBayRef,
  resolveCrawlerRef,
  resolveInstalledRef,
  resolveModuleRef,
  resolveRef,
  resolveSystemRef,
} from './resolveRefs.js'
export type { RulesClaim } from './rulesBearing.js'
export { statesMechanicalChange } from './rulesBearing.js'
export { salvageValueFor, scrapCostFor, tierUpgradeCost } from './scrap.js'
export {
  evaluateMechWarnings,
  evaluatePilotWarnings,
  evaluateSoftWarnings,
  PILOT_ABILITY_CAP,
  SALVAGER_ABILITY_CAP,
} from './softWarnings.js'
export type {
  CriticalDamageEffect,
  CriticalInjuryEffect,
  DamageKind,
  MechDamageEffect,
  MechDamageInput,
  PilotDamageEffect,
  PilotDamageInput,
} from './takeDamage.js'
export {
  applyMechDamage,
  applyPilotDamage,
  applySpDamage,
  criticalDamageOutcome,
  criticalInjuryOutcome,
  mechEffectiveDamage,
  performCriticalDamage,
  performCriticalInjury,
  pilotEffectiveDamage,
} from './takeDamage.js'
export type {
  AbilityInput,
  AbilityTier,
  CapacityViolation,
  CargoCapacityResult,
  // Cargo
  CargoItem,
  CargoItemCustom,
  CargoItemRef,
  CargoParent,
  CargoViolation,
  // Take Damage / Critical Damage / Critical Injury
  CriticalDamageOutcome,
  CriticalDamageResult,
  CriticalInjuryOutcome,
  CriticalInjuryResult,
  EditSnapshot,
  HeatCheckEffect,
  HeatCheckResult,
  MechCapacityResult,
  // Capacity
  MechInput,
  MechModuleSlot,
  MechSnapshot,
  MechSystemSlot,
  MediatorRollResult,
  // Mediator tables
  MediatorTableId,
  // Soft warnings
  PilotSnapshot,
  PushResult,
  ReactorOverloadOutcome,
  // Heat Check / Reactor Overload
  Roll,
  // Scrap
  ScrapableItem,
  SoftWarning,
  SoftWarningContext,
  SoftWarningSeverity,
  SystemSnapshot,
  // Shared primitives
  TechLevel,
} from './types.js'
