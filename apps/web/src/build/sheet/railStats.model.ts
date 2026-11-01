/**
 * Rail vitals + status derivations — pure functions, no JSX.
 *
 * Not components, so kept out of any: a file that mixes component and
 * non-component exports breaks React Fast Refresh.
 */

import { mechMaxima, pilotMaxima } from 'game-domain/rules/crewStatus'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { SoftLink } from 'game-domain/schemas/softLink'
import { CONDITION_LABELS } from 'salvageunion-reference'
import { crawlerMaxSP, resolveGauge, resolvePool } from 'salvageunion-reference/rules'
import type { StatState } from '../../components/index'
import type { VitalReading } from '../../lib/units/readings'
import { VITAL, vitalReading } from '../../lib/units/readings'

/**
 * One reading on a rail line — plain builders below, NOT components.
 *
 * The markup is the canonical `Stat` (`surface="plain"`, ruleset §3.7);
 * `rowStats` (below) adapts a list of these into the `UnitRow` readings the
 * text, and these functions just supply the numbers.
 *
 * The rules math stays here rather than moving into src/components, which is
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

const { sp: SP, ep: EP, heat: HEAT, hp: HP, ap: AP } = VITAL

/**
 * Mech rail vitals: "SP 9/13 · EP 6/11 · Heat 4/12".
 *
 * `pilotAbilities` are the abilities of the pilot assigned to the mech, or
 * undefined for an unlinked one: Beefcake raises the piloted mech's Max SP
 * (ADR-029), so the rail reads the same maxima as the mech's sheet
 * (`mechMaxima`). Required, so a caller cannot forget the pilot.
 */
export function mechRailItems(mech: Mech, pilotAbilities: string[] | undefined): RailStat[] {
  const { maxSP, maxEP, maxHeat } = mechMaxima(mech, pilotAbilities, [])
  return [
    { label: SP, value: resolvePool(mech.currentSP, maxSP), max: maxSP },
    { label: EP, value: resolvePool(mech.currentEP, maxEP), max: maxEP },
    { label: HEAT, value: resolveGauge(mech.currentHeat, maxHeat), max: maxHeat },
  ]
}

/**
 * Pilot rail vitals: "HP 7/10 · AP 4/6".
 *
 * `crawler` is the one the pilot crews (null for none): its Tech Level raises
 * max HP/AP via Stat Training (`pilotMaxima`). Required, so a caller cannot
 * read a Tech 1 pilot by omission.
 */
export function pilotRailItems(
  pilot: Pilot,
  crawler: Pick<Crawler, 'techLevel'> | null
): RailStat[] {
  const { maxHP, maxAP } = pilotMaxima(pilot, crawler)
  return [
    { label: HP, value: resolvePool(pilot.currentHP, maxHP), max: maxHP },
    { label: AP, value: resolvePool(pilot.currentAP, maxAP), max: maxAP },
  ]
}

/**
 * Each pilot's and mech's stat chips as their own sheets read them: a pilot
 * with the crawler they crew (Stat Training), a mech with its assigned
 * pilot's abilities (Beefcake), by the links between them.
 */
export function crewReadings(
  pilots: readonly Pilot[],
  mechs: readonly Mech[],
  crawlers: readonly Crawler[],
  links: readonly Pick<SoftLink, 'type' | 'from' | 'to'>[]
) {
  const linkedTo = (type: string, fromId: string) =>
    links.find((l) => l.type === type && l.from.id === fromId)?.to.id
  const pilot = (id: string | undefined) => pilots.find((p) => p.id === id)
  const crawler = (id: string | undefined) => crawlers.find((c) => c.id === id) ?? null
  return {
    pilotReadings: new Map(
      pilots.map((p) => [
        p.id,
        rowStats(pilotRailItems(p, crawler(linkedTo('pilot-to-crawler', p.id)))),
      ])
    ),
    mechReadings: new Map(
      mechs.map((m) => [
        m.id,
        rowStats(mechRailItems(m, pilot(linkedTo('mech-to-pilot', m.id))?.abilities)),
      ])
    ),
  }
}

/** Crawler rail vitals: "SP 9/13 · Bays 4/5 Intact". */
export function crawlerRailItems(crawler: Crawler): RailStat[] {
  const maxSP = crawlerMaxSP(crawler)
  const states = bayStates(crawler)
  const intact = states.filter((s) => s === 'intact').length
  return [
    { label: SP, value: resolvePool(crawler.currentSP, maxSP), max: maxSP },
    // Bays only appear once the crawler HAS bays: never an empty "Bays 0/0" line.
    ...(states.length > 0
      ? [{ label: 'Bays', value: intact, max: states.length, suffix: CONDITION_LABELS.intact }]
      : []),
  ]
}

/** Bay conditions as StatBlock pip states (Intact/Damaged only). */
export function bayStates(crawler: Crawler): StatState[] {
  return (crawler.crawlerBays ?? []).map((bay) => bay.condition ?? 'intact')
}

/**
 * Rail stats as a unit's readings: `SP 9/13`, `Bays 4/5 Intact` — the same
 * `current/max` reading every unit surface shows (`lib/units/readings.ts`).
 */
export function rowStats(items: RailStat[]): VitalReading[] {
  return items.map((item) => vitalReading(item.label, item.value, item.max, item.suffix))
}
