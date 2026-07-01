/**
 * Union Crawler Downtime Procedure (design-review R-2).
 *
 * Salvage Union Core Book p.227-228 — the per-session bookkeeping loop that
 * today costs ~8 manual edits across three sheets. Rules summary:
 *
 * - "Restore your Mech & Pilot" (p.228): a mech's SP and Energy fully restore
 *   and its Heat drops to 0. Damaged Mech Chassis, Systems and Modules are
 *   repaired to Intact as long as their Tech Level is ≤ the Crawler's
 *   (Destroyed items are never repaired — they are salvage).
 * - Med Bay (p.223): Tech 1-2 heals a pilot to full HP; Tech 3-4 also heals
 *   Minor Injuries; Tech 5-6 also heals Major Injuries. "If the Med Bay is
 *   damaged, you cannot heal any of your Pilot's Hit Points or injuries."
 *   AP restores through Downtime rest regardless (the damage clause blocks
 *   only HP + injuries).
 * - "Train your Pilot" (p.228): +1 Training Point per pilot per Downtime.
 * - Uses (X) counters recharge after Downtime (rules A14/B13). The Orbital
 *   Lance Controller explicitly never regains uses — it stays hand-managed.
 * - Once-per-Downtime bookkeeping resets: used pilot abilities and the
 *   Background/Keepsake/Motto 'Used' toggles (rules A8-A10).
 * - Upkeep (p.227, rules C3): 5 Scrap of the crawler's Tech Level per
 *   Downtime. Paying it is a separate economy action (a later package) —
 *   this module only names the cost for the prompt.
 *
 * This module is PURE (no React, no store, no randomness): it resolves the
 * workspace scope from the SoftLink graph and computes per-entity patches the
 * caller applies through the entity store. Per ADR-007 every step is
 * individually skippable — the runner dialog shows what will be applied and
 * the player deselects anything the table rules differently.
 */

import { SalvageUnionReference } from 'salvageunion-reference'

import { resolveCrawlerBay } from '../crawlerRefs'
import { parseCrawlerTechLevel } from '../crawlerLevel'
import type { Crawler } from '../schemas/crawler'
import type { ItemConditionMap, Mech } from '../schemas/mech'
import type { Pilot } from '../schemas/pilot'
import type { SoftLink } from '../schemas/softLink'
import { mechMaxEP, mechMaxSP, pilotMaxAP, pilotMaxHP } from './derivedStats'

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

/** The skippable Downtime steps, in rules order (p.227-228). */
export const DOWNTIME_STEP_KEYS = [
  'restoreMechs',
  'repairItems',
  'healPilots',
  'healInjuries',
  'trainPilots',
  'rechargeUses',
  'clearUsed',
] as const

export type DowntimeStepKey = (typeof DOWNTIME_STEP_KEYS)[number]

/** Which steps the player left enabled (ADR-007: every step skippable). */
export type DowntimeSteps = Record<DowntimeStepKey, boolean>

/** All steps enabled — the dialog's starting state. */
export function allDowntimeSteps(): DowntimeSteps {
  return {
    restoreMechs: true,
    repairItems: true,
    healPilots: true,
    healInjuries: true,
    trainPilots: true,
    rechargeUses: true,
    clearUsed: true,
  }
}

/** Upkeep cost: 5 Scrap of the crawler's Tech Level per Downtime (rules C3). */
export const DOWNTIME_UPKEEP_SCRAP = 5

// ---------------------------------------------------------------------------
// Scope — the crawler's workspace over the SoftLink graph
// ---------------------------------------------------------------------------

export type DowntimeScope = {
  /** Every pilot wired to the crawler (pilot-to-crawler links). */
  pilots: Pilot[]
  /** Each crew pilot's mech (mech-to-pilot links), deduplicated. */
  mechs: Mech[]
}

type DowntimeScopeInput = {
  crawler: Pick<Crawler, 'id'>
  pilots: Pilot[]
  mechs: Mech[]
  links: SoftLink[]
}

/**
 * Resolves which pilots and mechs Downtime touches: the crawler's crew
 * (pilot-to-crawler links) plus each crew pilot's mech (mech-to-pilot links).
 * Orphaned links (deleted endpoints) resolve to nothing and are skipped.
 */
export function resolveDowntimeScope({
  crawler,
  pilots,
  mechs,
  links,
}: DowntimeScopeInput): DowntimeScope {
  const crewIds = links
    .filter((l) => l.type === 'pilot-to-crawler' && l.to.id === crawler.id)
    .map((l) => l.from.id)
  const crewIdSet = new Set(crewIds)
  const crewPilots = pilots.filter((p) => crewIdSet.has(p.id))

  const mechIds = new Set(
    links.filter((l) => l.type === 'mech-to-pilot' && crewIdSet.has(l.to.id)).map((l) => l.from.id)
  )
  const crewMechs = mechs.filter((m) => mechIds.has(m.id))

  return { pilots: crewPilots, mechs: crewMechs }
}

// ---------------------------------------------------------------------------
// Med Bay gate (p.223)
// ---------------------------------------------------------------------------

export type MedBayStatus = {
  /** A Med Bay is installed on the crawler. */
  present: boolean
  /** The installed Med Bay is currently Damaged. */
  damaged: boolean
  /** present && !damaged — HP and injuries can heal at all. */
  operational: boolean
  /** operational && crawler Tech 3+ — Minor Injuries heal. */
  healsMinor: boolean
  /** operational && crawler Tech 5+ — Major Injuries heal. */
  healsMajor: boolean
}

const MED_BAY_NAME = 'Med Bay'

/**
 * The crawler's Med Bay capability this Downtime: presence + Damaged state of
 * the installed bay, banded by the crawler's Tech Level (Tech 1-2 HP only,
 * Tech 3-4 + Minor, Tech 5-6 + Major — p.223). No Med Bay, or a Damaged one,
 * blocks HP and injury healing entirely.
 */
export function medBayStatus(crawler: Pick<Crawler, 'crawlerBays' | 'techLevel'>): MedBayStatus {
  const entry = (crawler.crawlerBays ?? []).find(
    (bay) => resolveCrawlerBay(bay.bayRef)?.name === MED_BAY_NAME
  )
  const present = entry !== undefined
  const damaged = present && (entry.condition ?? 'intact') === 'damaged'
  const operational = present && !damaged
  const tl = parseCrawlerTechLevel(crawler.techLevel) ?? 1
  return {
    present,
    damaged,
    operational,
    healsMinor: operational && tl >= 3,
    healsMajor: operational && tl >= 5,
  }
}

// ---------------------------------------------------------------------------
// Mech patch (restore + repair + recharge)
// ---------------------------------------------------------------------------

/** The 'Chassis Damaged' condition label written by the Critical Damage flow. */
export const CHASSIS_DAMAGED_CONDITION = 'Chassis Damaged'

/** Resolve an installed system/module ref (id or name) to its Tech Level. */
function installedItemTechLevel(ref: string): number | undefined {
  const item =
    SalvageUnionReference.Systems.find((s) => s.id === ref || s.name === ref) ??
    SalvageUnionReference.Modules.find((m) => m.id === ref || m.name === ref)
  return typeof item?.techLevel === 'number' ? item.techLevel : undefined
}

/** Resolve the mech's chassis Tech Level (chassisRef stores the NAME). */
function chassisTechLevel(chassisRef: string): number | undefined {
  const chassis = SalvageUnionReference.Chassis.find((c) => c.name === chassisRef)
  return typeof chassis?.techLevel === 'number' ? chassis.techLevel : undefined
}

export type RepairableItems = {
  /** Damaged system/module refs the Downtime repair flips to Intact. */
  repairable: string[]
  /** Damaged refs that stay Damaged: Tech Level above the crawler's, or unresolvable. */
  blocked: string[]
  /** The 'Chassis Damaged' condition clears (chassis TL ≤ crawler TL). */
  chassisRepairable: boolean
}

/**
 * Which of the mech's Damaged items this Downtime repairs: systems/modules
 * (and the chassis' 'Chassis Damaged' condition) with a Tech Level ≤ the
 * crawler's flip to Intact (p.228). Destroyed items are never repaired;
 * unresolvable refs (custom items) are left alone and reported as blocked.
 */
export function repairableItems(
  mech: Pick<Mech, 'systemConditions' | 'moduleConditions' | 'conditions' | 'chassisRef'>,
  crawlerTl: number
): RepairableItems {
  const repairable: string[] = []
  const blocked: string[] = []
  const damagedRefs = [
    ...Object.entries(mech.systemConditions ?? {}),
    ...Object.entries(mech.moduleConditions ?? {}),
  ]
    .filter(([, condition]) => condition === 'damaged')
    .map(([ref]) => ref)
  for (const ref of damagedRefs) {
    const tl = installedItemTechLevel(ref)
    if (tl !== undefined && tl <= crawlerTl) {
      repairable.push(ref)
    } else {
      blocked.push(ref)
    }
  }

  const chassisDamaged = mech.conditions.some(
    (c) => c.trim().toLowerCase() === CHASSIS_DAMAGED_CONDITION.toLowerCase()
  )
  const chassisTl = chassisTechLevel(mech.chassisRef)
  const chassisRepairable = chassisDamaged && chassisTl !== undefined && chassisTl <= crawlerTl

  return { repairable, blocked, chassisRepairable }
}

/** Flip every repairable ref in a condition map to 'intact' (others untouched). */
function repairConditionMap(
  map: ItemConditionMap | undefined,
  repairable: ReadonlySet<string>
): ItemConditionMap | undefined {
  if (!map) return undefined
  let changed = false
  const next: ItemConditionMap = {}
  for (const [ref, condition] of Object.entries(map)) {
    if (condition === 'damaged' && repairable.has(ref)) {
      next[ref] = 'intact'
      changed = true
    } else {
      next[ref] = condition
    }
  }
  return changed ? next : undefined
}

/**
 * The Downtime patch for one mech. Only fields that actually change are
 * included — an empty patch means "skip the write". A Destroyed mech is
 * skipped entirely: Downtime repairs Damaged, never resurrects Destroyed
 * (build a new mech in the Crafting Bay instead).
 */
export function downtimeMechPatch(
  mech: Mech,
  crawlerTl: number,
  steps: DowntimeSteps
): Partial<Mech> {
  if (mech.destroyed) return {}
  const patch: Partial<Mech> = {}

  if (steps.restoreMechs) {
    const maxSP = mechMaxSP(mech)
    const maxEP = mechMaxEP(mech)
    if (mech.currentSP !== undefined && mech.currentSP !== maxSP) patch.currentSP = maxSP
    if (mech.currentEP !== undefined && mech.currentEP !== maxEP) patch.currentEP = maxEP
    if ((mech.currentHeat ?? 0) !== 0) patch.currentHeat = 0
  }

  if (steps.repairItems) {
    const { repairable, chassisRepairable } = repairableItems(mech, crawlerTl)
    const repairSet = new Set(repairable)
    const nextSystems = repairConditionMap(mech.systemConditions, repairSet)
    if (nextSystems) patch.systemConditions = nextSystems
    const nextModules = repairConditionMap(mech.moduleConditions, repairSet)
    if (nextModules) patch.moduleConditions = nextModules
    if (chassisRepairable) {
      patch.conditions = mech.conditions.filter(
        (c) => c.trim().toLowerCase() !== CHASSIS_DAMAGED_CONDITION.toLowerCase()
      )
    }
  }

  if (steps.rechargeUses && Object.keys(mech.itemUses ?? {}).length > 0) {
    // Absent key = full uses (rules B13) — clearing the map recharges everything.
    patch.itemUses = {}
  }

  return patch
}

// ---------------------------------------------------------------------------
// Pilot patch (heal + train + recharge + once-per-Downtime resets)
// ---------------------------------------------------------------------------

/**
 * Equipment that never regains Uses at Downtime (hand-managed): the Orbital
 * Lance Controller's satellite only ever holds three strikes.
 */
export const NEVER_RECHARGE_EQUIPMENT = ['Orbital Lance Controller'] as const

/** True when an equipmentUses key (id or name ref) is a never-recharge item. */
function isNeverRecharge(ref: string): boolean {
  const equipment = SalvageUnionReference.Equipment.find((e) => e.id === ref || e.name === ref)
  const name = equipment?.name ?? ref
  return NEVER_RECHARGE_EQUIPMENT.some((n) => n === name)
}

export type HealableInjuries = {
  /** Minor injuries that heal this Downtime. */
  minor: number
  /** Major injuries that heal this Downtime. */
  major: number
  /** Injuries that stay (Med Bay Tech Level too low / bay not operational). */
  remaining: number
}

/** How many of the pilot's injuries this Downtime heals, per the Med Bay bands. */
export function healableInjuries(
  pilot: Pick<Pilot, 'injuries'>,
  medBay: MedBayStatus
): HealableInjuries {
  const injuries = pilot.injuries ?? []
  const minor = medBay.healsMinor ? injuries.filter((i) => i.severity === 'minor').length : 0
  const major = medBay.healsMajor ? injuries.filter((i) => i.severity === 'major').length : 0
  return { minor, major, remaining: injuries.length - minor - major }
}

/**
 * The Downtime patch for one pilot. Only fields that actually change are
 * included — an empty patch means "skip the write".
 *
 * Ordering matters: injuries heal FIRST, then HP restores to the max derived
 * from the injuries that remain — healing a Minor Injury at a Tech 3 Med Bay
 * restores the pilot to the recovered maximum in one pass.
 */
export function downtimePilotPatch(
  pilot: Pilot,
  medBay: MedBayStatus,
  steps: DowntimeSteps
): Partial<Pilot> {
  const patch: Partial<Pilot> = {}

  // Heal injuries per the Med Bay bands (p.223).
  let remainingInjuries = pilot.injuries ?? []
  if (steps.healInjuries && (medBay.healsMinor || medBay.healsMajor)) {
    const next = remainingInjuries.filter(
      (i) =>
        (i.severity === 'minor' && !medBay.healsMinor) ||
        (i.severity === 'major' && !medBay.healsMajor)
    )
    if (next.length !== remainingInjuries.length) {
      patch.injuries = next
      remainingInjuries = next
    }
  }

  if (steps.healPilots) {
    // AP restores through Downtime rest regardless of the Med Bay (p.228);
    // HP healing requires an operational Med Bay (p.223).
    const maxAP = Math.max(0, pilotMaxAP(pilot))
    if (pilot.currentAP !== undefined && pilot.currentAP !== maxAP) patch.currentAP = maxAP
    if (medBay.operational) {
      const maxHP = Math.max(0, pilotMaxHP({ ...pilot, injuries: remainingInjuries }))
      if (pilot.currentHP !== undefined && pilot.currentHP !== maxHP) patch.currentHP = maxHP
    }
  }

  if (steps.trainPilots) {
    patch.trainingPoints = (pilot.trainingPoints ?? 0) + 1
  }

  if (steps.rechargeUses) {
    const uses = pilot.equipmentUses ?? {}
    const kept = Object.fromEntries(Object.entries(uses).filter(([ref]) => isNeverRecharge(ref)))
    if (Object.keys(kept).length !== Object.keys(uses).length) {
      // Absent key = full uses (rules A14); never-recharge items keep their count.
      patch.equipmentUses = kept
    }
  }

  if (steps.clearUsed) {
    if ((pilot.usedAbilities ?? []).length > 0) patch.usedAbilities = []
    if (Object.values(pilot.usedToggles ?? {}).some((used) => used === true)) {
      patch.usedToggles = {}
    }
  }

  return patch
}
