/**
 * Rule-enforcement utilities barrel (ADR-006 — pure rules logic lives here).
 *
 * Pure TypeScript — no React, no IndexedDB, no app dependency.
 * All functions are synchronous; same input always yields same output. There
 * is no randomness here: every die arrives as an injected `Roll`, which
 * production callers back with Randsum (component-lib's `rollDie`).
 *
 * Prerequisites: the salvageunion-reference schemas used by these utilities
 * must be preloaded before the first call:
 *   SalvageUnionReference.preload(['chassis', 'systems', 'modules', 'equipment', 'crawler-tech-levels'])
 * or, where dynamic `import()` is unavailable (Convex), installed from the
 * imported files with `SalvageUnionReference.install({ chassis, … })`.
 *
 * Migrated from apps/itun/src/lib/rules/ — see ADR-006. Tier 1/2
 * modules (fully portable pure math) live here; Tier 3 modules (deep coupling
 * to full persisted records + app-storage conventions like CargoLot /
 * crypto.randomUUID()) remain app-local in ITUN for now.
 *
 * Every name is re-exported explicitly, and only names with a consumer outside
 * the package are listed; add a name when something imports it.
 */

export type { AdvancementOption } from './advancement'
export { advancementOptionsFor, originsForHybrid, resolveAdvancementTrees } from './advancement'
export { liveAdvancementDataset, offeredAbilityTrees } from './advancementDataset'
export { computeMechCapacity } from './capacity'
export { isSchemaOnlyCatalogChoice, resolveCatalogChoiceEntities } from './choiceCatalog'
export { abilityContributions, sumContributions } from './contributions'
export type { CoreRollBand, CoreRollResult } from './coreMechanic'
export {
  CORE_ROLL_BANDS,
  coreRollBand,
  describeOverloadOutcome,
  describePushOutcome,
  performCoreRoll,
} from './coreMechanic'
export { computeCrawlerCapacity } from './crawlerCapacity'
export { isWeaponSystem } from './crawlerSystems'
export type { CrawlerMutationInput, MechCreationBudget } from './creation'
export {
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
} from './creation'
export type { ChassisStats, StatBreakdown } from './derivedStats'
export {
  crawlerMaxSP,
  crawlerMaxSPParts,
  isPilotDead,
  mechMaxCargo,
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
  pinFor,
  resolveGauge,
  resolvePool,
  resolvePoolStart,
  unifiedMechConditions,
} from './derivedStats'
export { canActivateAction, clampHeat, performHeatCheck, performPush } from './heatCheck'
export { enrichPilotSnapshot } from './pilotSnapshot'
export {
  resolveChassisRef,
  resolveCrawlerBayRef,
  resolveCrawlerRef,
  resolveInstalledRef,
  resolveModuleRef,
  resolveSystemRef,
} from './resolveRefs'
export { statesMechanicalChange } from './rulesBearing'
export type { AreaSalvageResult } from './salvage'
export { performAreaSalvage } from './salvage'
export { scrapCostFor, tierUpgradeCost } from './scrap'
export { evaluateSoftWarnings } from './softWarnings'
export type {
  CriticalDamageEffect,
  CriticalInjuryEffect,
  MechDamageEffect,
  PilotDamageEffect,
} from './takeDamage'
export {
  applyMechDamage,
  applyPilotDamage,
  performCriticalDamage,
  performCriticalInjury,
} from './takeDamage'
export type {
  HeatCheckEffect,
  MechSnapshot,
  PilotSnapshot,
  Roll,
  SoftWarning,
  SoftWarningContext,
  TechLevel,
} from './types'
