/**
 * Rule-enforcement utilities barrel (ADR-006 — pure rules logic lives here).
 *
 * Pure TypeScript — no React, no IndexedDB, no app dependency.
 * All functions are synchronous; same input always yields same output, except
 * `rollDie`, the real-RNG `Roll` that callers inject into the rest.
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

export type { AdvancementOption } from './advancement.js'
export { advancementOptionsFor, originsForHybrid, resolveAdvancementTrees } from './advancement.js'
export { liveAdvancementDataset, offeredAbilityTrees } from './advancementDataset.js'
export { computeMechCapacity } from './capacity.js'
export { isSchemaOnlyCatalogChoice, resolveCatalogChoiceEntities } from './choiceCatalog.js'
export { abilityContributions, sumContributions } from './contributions.js'
export type { CoreRollBand, CoreRollResult } from './coreMechanic.js'
export {
  CORE_ROLL_BANDS,
  coreRollBand,
  describeOverloadOutcome,
  describePushOutcome,
  performCoreRoll,
} from './coreMechanic.js'
export { computeCrawlerCapacity } from './crawlerCapacity.js'
export { isWeaponSystem } from './crawlerSystems.js'
export type { CrawlerMutationInput, MechCreationBudget } from './creation.js'
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
} from './creation.js'
export type { ChassisStats, StatBreakdown } from './derivedStats.js'
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
} from './derivedStats.js'
export { rollDie } from './dice.js'
export { canActivateAction, clampHeat, performHeatCheck, performPush } from './heatCheck.js'
export { enrichPilotSnapshot } from './pilotSnapshot.js'
export {
  matchesRef,
  resolveChassisRef,
  resolveCrawlerBayRef,
  resolveCrawlerRef,
  resolveInstalledRef,
  resolveModuleRef,
  resolveRef,
  resolveSystemRef,
} from './resolveRefs.js'
export { statesMechanicalChange } from './rulesBearing.js'
export { scrapCostFor, tierUpgradeCost } from './scrap.js'
export { evaluateSoftWarnings } from './softWarnings.js'
export type {
  CriticalDamageEffect,
  CriticalInjuryEffect,
  MechDamageEffect,
  PilotDamageEffect,
} from './takeDamage.js'
export {
  applyMechDamage,
  applyPilotDamage,
  performCriticalDamage,
  performCriticalInjury,
} from './takeDamage.js'
export type {
  HeatCheckEffect,
  MechSnapshot,
  PilotSnapshot,
  Roll,
  SoftWarning,
  SoftWarningContext,
  TechLevel,
} from './types.js'
