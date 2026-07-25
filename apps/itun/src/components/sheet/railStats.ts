/**
 * Rail vitals + status derivations — pure functions, no JSX.
 *
 * Split out of SheetRailParts.tsx because these are not components: keeping
 * them beside one meant the file mixed component and non-component exports,
 * which breaks React Fast Refresh (and needed a suppression per function).
 */

import type { BadgeTone, StatState } from 'component-lib'

import {
  crawlerMaxSP,
  mechMaxEP,
  mechMaxHeat,
  mechMaxSP,
  pilotMaxAP,
  pilotMaxHP,
} from '../../lib/rules/derivedStats'
import { partnerDerivedStats } from '../../lib/rules/partnerStats'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { PartnerInstance } from '../../lib/schemas/partner'
import type { Pilot } from '../../lib/schemas/pilot'

/**
 * One reading on a rail line — plain builders below, NOT components.
 *
 * These were three components that each hand-wrote the same inline markup and
 * differed only in WHICH stats they listed. The markup itself is now the
 * canonical `Stat` (`orientation="horizontal" surface="plain"`, ruleset §3.7);
 * `rowStats` (below) adapts a list of these into the `EntityRow` stat cells the
 * text, and these functions just supply the numbers.
 *
 * The rules math stays here rather than moving into component-lib, which is
 * data-source agnostic (ADR-010).
 */
export type RailStat = {
  /** Short stat name as printed — "SP", "EP", "Heat", "Bays". */
  label: string
  value: number
  max: number
  /**
   * Trailing word after the reading ("Intact" in "Bays 4/5 Intact"). It belongs
   * to the READING, not to the cell — `rowStats` appends it after the value so
   * `Stat` keeps a clean `label | value` contract.
   */
  suffix?: string
}

/** Mech rail vitals: "SP 9/13 · EP 6/11 · Heat 4/12". */
export function mechRailItems(mech: Mech): RailStat[] {
  const maxSP = mechMaxSP(mech)
  const maxEP = mechMaxEP(mech)
  const maxHeat = mechMaxHeat(mech)
  return [
    { label: 'SP', value: mech.currentSP ?? maxSP, max: maxSP },
    { label: 'EP', value: mech.currentEP ?? maxEP, max: maxEP },
    { label: 'Heat', value: mech.currentHeat ?? maxHeat, max: maxHeat },
  ]
}

/**
 * Partner rail vitals: "SP 7/7 · EP 8/8 · Heat 0/6".
 *
 * The same three readings as a mech, because a partner "uses the same rules as
 * Mechs for … taking damage and being repaired; as well as Heat and Heat
 * Checks" (Core Book, four separate partner entries). The maxima come from
 * `partnerDerivedStats` rather than the mech helpers: a partner's ceilings scale
 * off its own stat block and tech level, which for a pilot-granted partner is
 * the UNION CRAWLER's tech level, not its host's.
 */
export function partnerRailItems(partner: PartnerInstance, techLevel: number): RailStat[] {
  const max = partnerDerivedStats(partner, techLevel)
  return [
    { label: 'SP', value: partner.currentSP ?? max.structurePoints, max: max.structurePoints },
    { label: 'EP', value: partner.currentEP ?? max.energyPoints, max: max.energyPoints },
    { label: 'Heat', value: partner.currentHeat ?? 0, max: max.heatCapacity },
  ]
}

/** Pilot rail vitals: "HP 7/10 · AP 4/6". */
export function pilotRailItems(pilot: Pilot): RailStat[] {
  const maxHP = Math.max(0, pilotMaxHP(pilot))
  const maxAP = Math.max(0, pilotMaxAP(pilot))
  return [
    { label: 'HP', value: pilot.currentHP ?? maxHP, max: maxHP },
    { label: 'AP', value: pilot.currentAP ?? maxAP, max: maxAP },
  ]
}

/** Crawler rail vitals: "SP 9/13 · Bays 4/5 Intact". */
export function crawlerRailItems(crawler: Crawler): RailStat[] {
  const maxSP = crawlerMaxSP(crawler)
  const states = bayStates(crawler)
  const intact = states.filter((s) => s === 'intact').length
  return [
    { label: 'SP', value: crawler.currentSP ?? maxSP, max: maxSP },
    // Bays only appear once the crawler HAS bays — an empty "Bays 0/0" line was
    // never rendered before and must not start now.
    ...(states.length > 0
      ? [{ label: 'Bays', value: intact, max: states.length, suffix: 'Intact' }]
      : []),
  ]
}

/** Bay conditions as StatBlock pip states (Intact/Damaged only, rules C8). */
export function bayStates(crawler: Crawler): StatState[] {
  return (crawler.crawlerBays ?? []).map((bay) => bay.condition ?? 'intact')
}

/** Destroyed > Damaged > Intact status pill for a mech. */
export function mechStatusPill(mech: Mech): { label: string; tone: BadgeTone } {
  if (mech.destroyed) return { label: 'Destroyed', tone: 'bad' }
  const anyDamaged = [
    ...Object.values(mech.systemConditions ?? {}),
    ...Object.values(mech.moduleConditions ?? {}),
  ].some((c) => c !== 'intact')
  return anyDamaged ? { label: 'Damaged', tone: 'warn' } : { label: 'Intact', tone: 'ok' }
}

/**
 * A rail stat as an `EntityRow` stat cell: `SP 9/13`, `Bays 4/5 Intact`.
 *
 * `EntityRow` (the roster/index row the linked-unit slots now use) takes flat
 * `label | value` pairs, while a rail stat carries its own max and sometimes a
 * trailing word, so both fold into the value here rather than the row growing
 * a shape only these call sites would use.
 */
export function rowStats(items: RailStat[]): { label: string; value: string }[] {
  return items.map((item) => ({
    label: item.label,
    value: `${item.value}/${item.max}${item.suffix ? ` ${item.suffix}` : ''}`,
  }))
}
