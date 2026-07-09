/**
 * Derived maxima for all three entities (plan 2.5, gap 11).
 *
 * Moved to packages/salvageunion-reference/lib/rules/derivedStats.ts
 * (ADR-006). Thin re-export shim — see that module for the implementation.
 */

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
} from 'salvageunion-reference/rules'
export type { ChassisStats } from 'salvageunion-reference/rules'
