/**
 * Derived maxima for all three entities (plan 2.5, gap 11).
 *
 * Moved to packages/salvageunion-reference/lib/rules/derivedStats.ts
 * (ADR-006). Thin re-export shim — see that module for the implementation.
 */

export type { ChassisStats, CrawlerMaxSPParts } from 'salvageunion-reference/rules'
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
  unifiedMechConditions,
} from 'salvageunion-reference/rules'
