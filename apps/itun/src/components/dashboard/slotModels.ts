/**
 * slotModels — the pure half of the slot row: each entity's numbers, and its
 * Minor as a `MinorModel` (docs/architecture/dashboard-redesign.md D3). No
 * React and no store, so the Ladle stories render the real derivations and a
 * Minor and the Major it opens into read the same maxima.
 */

import { linesFromBreakdown } from 'component-lib'
import {
  crawlerMaxSPParts,
  mechMaxCargo,
  mechMaxEP,
  mechMaxHeat,
  mechMaxSP,
  mechMaxSPParts,
  pilotMaxAPParts,
  pilotMaxHPParts,
  resolveChassisRef,
  resolveGauge,
  resolveModuleRef,
  resolvePool,
  resolveSystemRef,
} from 'salvageunion-reference/rules'
import { scrapPoolBucket } from '../../lib/cargo/cargoTransfer'
import { resolveEffectiveCrawlerLevel } from '../../lib/crawlerLevel'
import { resolveCrawlerBay } from '../../lib/crawlerRefs'
import { readReference } from '../../lib/readReference'
import { SCRAP_TLS } from '../../lib/rules/crawlerEconomy'
import { pilotingContext } from '../../lib/rules/pilotingContext'
import { totalLotUnits } from '../../lib/schemas/cargoLot'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { crawlerTechLevelOf } from './dashboardEconomy'
import type { BandGauge } from './MajorFrame'
import type { MinorModel } from './MinorFrame'

/** HP and AP with their derived maxima. `crawler`'s tier drives Stat Training. */
export function pilotVitals(pilot: Pilot, crawler: Crawler | null) {
  const statInput = { ...pilot, crawlerTechLevel: resolveEffectiveCrawlerLevel(pilot, crawler) }
  const hpParts = pilotMaxHPParts(statInput)
  const apParts = pilotMaxAPParts(statInput)
  const maxHP = Math.max(0, hpParts.total)
  const maxAP = Math.max(0, apParts.total)
  const gauges: BandGauge[] = [
    {
      label: 'HP',
      value: resolvePool(pilot.currentHP, maxHP),
      max: maxHP,
      tone: 'pilot',
      provenance: linesFromBreakdown(hpParts, {
        base: 'Pilot',
        baseDetail: 'base',
        installed: 'Injuries',
        installedDetail: 'rules A11',
      }),
      breakdown: hpParts,
    },
    {
      label: 'AP',
      value: resolvePool(pilot.currentAP, maxAP),
      max: maxAP,
      tone: 'pilot',
      provenance: linesFromBreakdown(apParts, { base: 'Pilot', baseDetail: 'base' }),
      breakdown: apParts,
    },
  ]
  return { statInput, maxHP, gauges }
}

/** Each injury, as the Minor and the Crew read it ("Major injury: broken arm"). */
export function injuryLines(pilot: Pilot): string[] {
  return (pilot.injuries ?? []).map((injury) => {
    const kind = injury.severity === 'major' ? 'Major injury' : 'Minor injury'
    return injury.note ? `${kind}: ${injury.note}` : kind
  })
}

/** The pilot as a Minor: HP and AP, with injuries surfacing in red. */
export function pilotMinorModel(
  pilot: Pilot,
  crawler: Crawler | null,
  boardedIn: string | null
): MinorModel {
  const problems = injuryLines(pilot)
  const where = boardedIn === null ? 'On foot' : `In ${boardedIn}`
  return {
    fam: 'pilot',
    name: pilot.name,
    gauges: pilotVitals(pilot, crawler).gauges,
    lines: [],
    problems,
    status: problems.length === 0 ? `${where} · no injuries` : where,
  }
}

/**
 * The mech's pools and their maxima. Beefcake is a PILOT ability that raises
 * the piloted MECH's Max SP and Cargo (ADR-029), so the pilot's abilities and
 * the seat's switched-on effects come in too.
 */
export function mechStats(
  mech: Mech,
  pilotAbilities: string[] | undefined,
  switchedOn: readonly string[]
) {
  const chassis = resolveChassisRef(mech.chassisRef)
  const active = Object.fromEntries(switchedOn.map((ref) => [ref, true]))
  const piloting = { ...pilotingContext(mech, pilotAbilities), active }
  const maxSP = mechMaxSP(mech, chassis, piloting)
  const maxEP = mechMaxEP(mech, chassis)
  const maxHeat = mechMaxHeat(mech, chassis)
  const maxCargo = mechMaxCargo(mech, chassis, piloting)
  return {
    chassis,
    active,
    piloting,
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

/** Every system or module that is not intact, by name ("Floodlights damaged"). */
function damagedItems(mech: Mech): string[] {
  const named = (
    conditions: Mech['systemConditions'],
    find: (ref: string) => { name: string } | null
  ) =>
    Object.entries(conditions ?? {})
      .filter(([, condition]) => condition !== 'intact')
      .map(([ref, condition]) => {
        const name = readReference('dashboard.mechItems', () => find(ref)?.name, undefined) ?? ref
        return `${name} ${condition}`
      })
  return [
    ...named(mech.systemConditions, resolveSystemRef),
    ...named(mech.moduleConditions, resolveModuleRef),
  ]
}

/** The mech as a Minor: SP, Heat and EP as text, and what is wrong with it. */
export function mechMinorModel(
  mech: Mech,
  pilotAbilities: string[] | undefined,
  activeEffects: readonly string[],
  boarded: boolean
): MinorModel {
  const s = mechStats(mech, pilotAbilities, activeEffects)
  const spParts = mechMaxSPParts(mech, s.chassis, s.piloting)
  const problems = [
    ...(mech.destroyed ? ['Destroyed'] : []),
    ...(mech.shutdown ? ['Shut down'] : []),
    ...damagedItems(mech),
  ]
  return {
    fam: 'mech',
    name: mech.name,
    aside: boarded ? 'boarded' : 'parked',
    gauges: [
      {
        label: 'SP',
        value: s.sp,
        max: s.maxSP,
        tone: 'mech',
        provenance: linesFromBreakdown(spParts, {
          base: `${s.chassis?.name ?? mech.chassisRef} chassis`,
          baseDetail: 'base',
          installed: 'Installed systems & modules',
        }),
        breakdown: spParts,
      },
    ],
    lines: [`Heat ${s.heat}/${s.maxHeat} · EP ${s.ep}/${s.maxEP}`],
    problems,
  }
}

/** SP with its derived maximum and the ledger behind it. */
export function hullGauge(crawler: Crawler): BandGauge {
  const spParts = crawlerMaxSPParts(crawler)
  const maxSP = spParts.total
  return {
    label: 'SP',
    value: resolvePool(crawler.currentSP, maxSP),
    max: maxSP,
    tone: 'crawler',
    provenance: linesFromBreakdown(spParts, {
      base: `Tech ${crawlerTechLevelOf(crawler) ?? '?'} Crawler`,
      baseDetail: 'base',
      installed: 'Crawler type bonus',
    }),
    breakdown: spParts,
  }
}

/** The scrap pool as one line: "Scrap T1×12 · T2×4", or "No scrap". */
export function scrapLine(crawler: Crawler): string {
  const pool = crawler.scrapPool ?? {}
  const held = SCRAP_TLS.map((tl) => ({ tl, n: scrapPoolBucket(pool, tl) })).filter((b) => b.n > 0)
  return held.length === 0 ? 'No scrap' : `Scrap ${held.map((b) => `T${b.tl}×${b.n}`).join(' · ')}`
}

/** Each installed bay by name, and whether it is damaged. */
export function bayConditions(crawler: Crawler): { name: string; damaged: boolean }[] {
  return (crawler.crawlerBays ?? []).map((bay) => ({
    name: resolveCrawlerBay(bay.bayRef)?.name ?? bay.bayRef,
    damaged: (bay.condition ?? 'intact') === 'damaged',
  }))
}

/** The crawler as a Minor: SP, Tech Level and scrap, with damaged bays in red. */
export function crawlerMinorModel(crawler: Crawler): MinorModel {
  const tl = crawlerTechLevelOf(crawler)
  return {
    fam: 'crawler',
    name: crawler.name,
    aside: tl === undefined ? undefined : `TL${tl}`,
    gauges: [hullGauge(crawler)],
    lines: [scrapLine(crawler)],
    problems: bayConditions(crawler)
      .filter((b) => b.damaged)
      .map((b) => `${b.name} damaged`),
  }
}
