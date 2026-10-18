/**
 * unitStats.model — each unit's numbers with their derived maxima, as the
 * Units column, the phone's pinned row and the crew read them (play.md §4).
 * No React and no store, so every place that shows a vital reads the same
 * maximum the server serves the crew (`cantina-domain/rules/crewStatus`).
 */

import { mechMaxima, pilotMaxima } from 'cantina-domain/rules/crewStatus'
import { totalLotUnits } from 'cantina-domain/schemas/cargoLot'
import type { Crawler } from 'cantina-domain/schemas/crawler'
import type { Mech } from 'cantina-domain/schemas/mech'
import type { Pilot } from 'cantina-domain/schemas/pilot'
import type { RefCrawlerBay } from 'salvageunion-reference'
import {
  crawlerMaxSPParts,
  mechMaxCargo,
  resolveGauge,
  resolvePool,
} from 'salvageunion-reference/rules'
import { resolveCrawlerBay } from '../lib/crawlerRefs'

/** One vital: its current value and its derived maximum. */
export type UnitGauge = { label: string; value: number; max: number }

/**
 * HP and AP with their derived maxima. `crawler`'s tier drives Stat Training.
 * The maxima are `pilotMaxima`, the derivation the server serves the crew.
 */
export function pilotVitals(
  pilot: Pilot,
  crawler: Pick<Crawler, 'techLevel'> | null
): { gauges: UnitGauge[] } {
  const { maxHP, maxAP } = pilotMaxima(pilot, crawler)
  return {
    gauges: [
      { label: 'HP', value: resolvePool(pilot.currentHP, maxHP), max: maxHP },
      { label: 'AP', value: resolvePool(pilot.currentAP, maxAP), max: maxAP },
    ],
  }
}

/** Each injury, as the Units box and the Crew read it ("Major injury: broken arm"). */
export function injuryLines(pilot: Pilot): string[] {
  return (pilot.injuries ?? []).map((injury) => {
    const kind = injury.severity === 'major' ? 'Major injury' : 'Minor injury'
    return injury.note ? `${kind}: ${injury.note}` : kind
  })
}

/**
 * The mech's pools and their maxima. Beefcake is a PILOT ability that raises
 * the piloted MECH's Max SP and Cargo (ADR-029), so the pilot's abilities and
 * the seat's switched-on effects come in too. SP, EP and Heat are
 * `mechMaxima`, the derivation the server serves the crew.
 */
export function mechStats(
  mech: Mech,
  pilotAbilities: string[] | undefined,
  switchedOn: readonly string[]
) {
  const { chassis, active, piloting, spParts, maxSP, maxEP, maxHeat } = mechMaxima(
    mech,
    pilotAbilities,
    switchedOn
  )
  const maxCargo = mechMaxCargo(mech, chassis, piloting)
  return {
    chassis,
    active,
    piloting,
    spParts,
    maxSP,
    maxEP,
    maxHeat,
    maxCargo,
    sp: resolvePool(mech.currentSP, maxSP),
    ep: resolvePool(mech.currentEP, maxEP),
    heat: resolveGauge(mech.currentHeat, maxHeat),
    cargo: totalLotUnits(mech.cargoLots),
  }
}

/** The crawler's SP with its derived maximum. */
export function hullGauge(crawler: Crawler): UnitGauge {
  const maxSP = crawlerMaxSPParts(crawler).total
  return { label: 'SP', value: resolvePool(crawler.currentSP, maxSP), max: maxSP }
}

/**
 * Each installed bay by name, its reference entity when it resolves (its
 * Token in the crawler's box), and whether it is damaged.
 */
export function bayConditions(
  crawler: Crawler
): { name: string; entity: RefCrawlerBay | null; damaged: boolean }[] {
  return (crawler.crawlerBays ?? []).map((bay) => {
    const entity = resolveCrawlerBay(bay.bayRef)
    return {
      name: entity?.name ?? bay.bayRef,
      entity,
      damaged: (bay.condition ?? 'intact') === 'damaged',
    }
  })
}
