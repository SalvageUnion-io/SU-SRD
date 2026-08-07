/**
 * Partner derivation — stat block resolution, tech level, and derived maxima.
 *
 * Lives in ITUN rather than `salvageunion-reference/rules` (ADR-006) because
 * resolving a partner's tech level reads ITUN state: a pilot-granted partner
 * scales off the Union Crawler the pilot is soft-linked to, which is player
 * data, not game data. The pure arithmetic underneath (base + per-tech-level
 * bonus) is trivial and stays here with its one caller.
 *
 * THE TECH LEVEL RULE IS THE SUBTLE PART, and it differs by grant path. From
 * the Core Book, stated identically for Auto-Turret (p. 29), Survey Drone
 * (p. 48) and Mecha Companion (p. 68):
 *
 *   "Your Auto-Turret has a Tech Level equal to your Union Crawler. Your
 *    Auto-Turret is upgraded along with your Union Crawler, it gains additional
 *    stats as shown for each Tech level above the first."
 *
 * — so a PILOT-granted partner tracks the CRAWLER, not the pilot, and not its
 * own record's `techLevel` (which is only the base row of the printed table).
 * Mecha Companion adds a floor: "equal to your Union Crawler (Tech 3 minimum)".
 *
 * MECH-granted drones say no such thing. Sestra Drone is Tech 3 and Big Brother
 * Drone is Tech 5, flat, and neither record carries `bonusPerTechLevel` — so
 * they do not scale at all.
 *
 * Getting this wrong is quiet rather than loud: the partner renders with
 * plausible stats that are simply the wrong ones, which is why the branch is
 * pinned by tests rather than left to the call sites.
 */

import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { StatBreakdown } from 'salvageunion-reference/rules'
import { matchesRef } from 'salvageunion-reference/rules'
import type { PartnerInstance } from '../schemas/partner'
import { partnerGrantCount } from './partnerGrants'

/** Mecha Companion's floor — "equal to your Union Crawler (Tech 3 minimum)". */
const MECHA_COMPANION_MIN_TECH_LEVEL = 3

/** Slug of the one partner carrying a tech-level floor. */
const MECHA_COMPANION_REF = 'mecha-companion'

/** Slug of the one partner whose own controller fields more than one. */
const BIG_BROTHER_DRONE_REF = 'big-brother-drone'

/** "The Big Brother can control up to 4 Big Brother Drones" (False Flag p. 62). */
const BIG_BROTHER_DRONE_CAP = 4

/** The stat keys a partner scales, all present on `bonusPerTechLevel`. */
const SCALED_STATS = [
  'structurePoints',
  'energyPoints',
  'heatCapacity',
  'systemSlots',
  'moduleSlots',
  'cargoCapacity',
] as const

export type PartnerStatKey = (typeof SCALED_STATS)[number]

export type PartnerDerivedStats = Record<PartnerStatKey, number>

/**
 * The reference record supplying a partner's stats.
 *
 * `hostSchema` is not optional cleverness — "Survey Drone" is a record in BOTH
 * `equipment` (the player's partner: SP 2, EP 4, 3 system slots) and `drones`
 * (an opposition stat block: SP 1 and nothing else). Searching both files by
 * slug would resolve the wrong one roughly half the time.
 */
export function resolvePartnerStatBlock(partner: PartnerInstance): SURefEntity | null {
  const model =
    partner.hostSchema === 'equipment'
      ? SalvageUnionReference.Equipment
      : SalvageUnionReference.Drones
  return model.find((entry) => matchesRef(entry, partner.hostRef)) ?? null
}

/** Read a numeric field off a resolved reference record. */
function statOf(entity: SURefEntity | null, key: string): number | undefined {
  if (!entity) return undefined
  const value = (entity as Record<string, unknown>)[key]
  return typeof value === 'number' ? value : undefined
}

/**
 * A partner's effective Tech Level.
 *
 * @param partner              the partner instance
 * @param crawlerTechLevel     the owning pilot's effective Union Crawler tech
 *                             level (from `resolveEffectiveCrawlerLevel`), or
 *                             undefined when the pilot has no crawler. Ignored
 *                             for mech-granted partners.
 *
 * An unlinked pilot degrades to the stat block's own base tech level rather
 * than throwing — a partner on a crawler-less pilot is a normal state (a fresh
 * build, an imported snapshot), not an error.
 */
export function partnerTechLevel(
  partner: PartnerInstance,
  crawlerTechLevel: number | undefined
): number {
  if (partner.techLevelOverride !== undefined) return partner.techLevelOverride

  const statBlock = resolvePartnerStatBlock(partner)
  const base = statOf(statBlock, 'techLevel') ?? 1

  // Mech-granted drones are fixed at their printed Tech Level and carry no
  // `bonusPerTechLevel` — the crawler never touches them.
  if (partner.hostSchema === 'drones') return base

  const fromCrawler = crawlerTechLevel ?? base
  const isMechaCompanion = statBlock !== null && matchesRef(statBlock, MECHA_COMPANION_REF)
  return isMechaCompanion ? Math.max(fromCrawler, MECHA_COMPANION_MIN_TECH_LEVEL) : fromCrawler
}

/**
 * A partner's derived maxima at a given tech level.
 *
 * "It gains additional stats as shown for each Tech level above the first" —
 * so the bonus applies `techLevel - 1` times, never at Tech 1. Records without
 * `bonusPerTechLevel` (every mech-granted drone) return their base row.
 */
export function partnerDerivedStats(
  partner: PartnerInstance,
  techLevel: number
): PartnerDerivedStats {
  const statBlock = resolvePartnerStatBlock(partner)
  const bonuses = (statBlock as { bonusPerTechLevel?: Record<string, number> } | null)
    ?.bonusPerTechLevel
  const steps = Math.max(0, techLevel - 1)

  const out = {} as PartnerDerivedStats
  for (const key of SCALED_STATS) {
    const base = statOf(statBlock, key) ?? 0
    const per = bonuses?.[key]
    out[key] = base + (typeof per === 'number' ? per * steps : 0)
  }
  return out
}

/**
 * A partner's derived maxima, decomposed per stat (ADR-029).
 *
 * The tech-level scaling is a partner's whole story and nothing on screen
 * explained it before, so each stat resolves to `{ base, installed, ... }` where
 * `installed` carries the scaling — a rules-sourced contribution, exactly like a
 * mech's summed `statBonus`.
 *
 * `override` is always absent: partners have no cap-pin field, so a partner stat
 * is never overridden.
 */
export function partnerDerivedStatsParts(
  partner: PartnerInstance,
  techLevel: number
): Record<PartnerStatKey, StatBreakdown> {
  const statBlock = resolvePartnerStatBlock(partner)
  const bonuses = (statBlock as { bonusPerTechLevel?: Record<string, number> } | null)
    ?.bonusPerTechLevel
  const steps = Math.max(0, techLevel - 1)

  const out = {} as Record<PartnerStatKey, StatBreakdown>
  for (const key of SCALED_STATS) {
    const base = statOf(statBlock, key) ?? 0
    const per = bonuses?.[key]
    const scaled = typeof per === 'number' ? per * steps : 0
    const derived = Math.max(0, base + scaled)
    out[key] = {
      base,
      installed: scaled,
      // Tech-level scaling is an anonymous aggregate, not a named source: it
      // comes from the stat block's own `bonusPerTechLevel`, not from a
      // separately-nameable ability.
      sources: [],
      adjustment: 0,
      derived,
      total: derived,
      overridden: false,
    }
  }
  return out
}

/**
 * How many of a given partner a host may field at once.
 *
 * Almost every partner is capped at one by its own text ("You may only ever have
 * one Auto-Turret at a time", and the same for Survey Drone, Mecha Companion,
 * and the Little Sestra's Sestra Drone). Two things raise it, and neither is
 * legible from the stat block:
 *
 *   - A PILOT ABILITY THAT GRANTS MORE THAN ONE. This used to string-match
 *     `mecha-packmaster`, which was both a hardcode and a duplicate: the fact
 *     already lives in the data, since Packmaster's `grants` lists Mecha
 *     Companion twice. Reading it means the cap and the number actually seeded
 *     can no longer drift apart, and a future ability that grants two needs no
 *     edit here. See `partnerGrantCount` for why it is a MAX, not a sum.
 *   - THE STAT BLOCK'S OWN CONTROLLER. The Big Brother "can control up to 4 Big
 *     Brother Drones", and its DronTek pattern fields exactly that many — so
 *     without this, every one of those four would read "4 of 1" the moment the
 *     mech was built. This one stays hardcoded: it is a chassis ability's prose,
 *     not a countable grant, and deriving it from "the most any pattern fields"
 *     would report 1 for a Custom build that is still allowed four.
 *
 * Advisory only. The Live Sheet is a Free-Edit surface (ADR-021) and the
 * automation boundary (ADR-007) keeps rules like this displayed rather than
 * enforced, so callers render `used/max` and never block.
 */
export function partnerCap(hostRef: string, hostAbilityRefs: readonly string[]): number {
  if (hostRef === BIG_BROTHER_DRONE_REF) return BIG_BROTHER_DRONE_CAP
  return partnerGrantCount(hostRef, hostAbilityRefs)
}
