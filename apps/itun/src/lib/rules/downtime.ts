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
 * - Mech Bay (p.221): restore and repair happen IN the Mech Bay. "If the
 *   Mech Bay becomes damaged, your Mechs can no longer restore SP and EP
 *   during Downtime. Their Chassis as well as any Systems or Modules will
 *   not be repaired if they are damaged." Mirrors the Med Bay gate below.
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
 * This module is PURE (no React, no store, no randomness): it computes
 * per-entity patches the caller applies through the entity store. Per ADR-007 every step is
 * individually skippable — the runner dialog shows what will be applied and
 * the player deselects anything the table rules differently.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import {
  mechMaxEP,
  mechMaxSP,
  pilotMaxAP,
  pilotMaxHP,
  resolveChassisRef,
  resolveGauge,
  resolveInstalledRef,
} from 'salvageunion-reference/rules'
import { parseCrawlerTechLevel } from '../crawlerLevel'
import type { Crawler } from '../schemas/crawler'
import type { ItemConditionMap } from '../schemas/itemCondition'
import type { Mech } from '../schemas/mech'
import type { Pilot } from '../schemas/pilot'

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

/**
 * The Crawler Downtime step Upkeep belongs to (p.227). Inside a Game's
 * Downtime, Upkeep is paid in this step and no other; the crawler sheet stays
 * editable at any time.
 */
export const UPKEEP_STEP_NAME = 'Upkeep & Upgrade'

/**
 * Whether the Downtime step at `stepIndex` is the Upkeep step, read from the
 * Crawler Downtime guide (the same steps `DowntimeWizard` renders). False when
 * Downtime is not running.
 */
export function isUpkeepStep(stepIndex: number | null): boolean {
  if (stepIndex === null) return false
  const steps = SalvageUnionReference.Guides.find((g) => g.guideType === 'downtime')?.steps
  return steps?.[stepIndex]?.name === UPKEEP_STEP_NAME
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

const MED_BAY = 'med-bay'

/**
 * The crawler's Med Bay capability this Downtime: presence + Damaged state of
 * the installed bay, banded by the crawler's Tech Level (Tech 1-2 HP only,
 * Tech 3-4 + Minor, Tech 5-6 + Major — p.223). No Med Bay, or a Damaged one,
 * blocks HP and injury healing entirely.
 */
export function medBayStatus(crawler: Pick<Crawler, 'crawlerBays' | 'techLevel'>): MedBayStatus {
  const entry = (crawler.crawlerBays ?? []).find((bay) => bay.bayRef === MED_BAY)
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
// Mech Bay gate (p.221)
// ---------------------------------------------------------------------------

export type MechBayStatus = {
  /** A Mech Bay is installed on the crawler. */
  present: boolean
  /** The installed Mech Bay is currently Damaged. */
  damaged: boolean
  /** present && !damaged — SP/EP/Heat restore and Downtime repairs can run. */
  operational: boolean
}

const MECH_BAY = 'mech-bay'

/**
 * The crawler's Mech Bay capability this Downtime. Every Union Crawler has a
 * Mech Bay at the crawler's own Tech Level (p.240), but a Damaged one blocks
 * SP/EP restoration and all Downtime repairs (p.221) — and a missing entry
 * (data drift) is reported so the runner can surface it instead of silently
 * restoring anyway.
 */
export function mechBayStatus(crawler: Pick<Crawler, 'crawlerBays'>): MechBayStatus {
  const entry = (crawler.crawlerBays ?? []).find((bay) => bay.bayRef === MECH_BAY)
  const present = entry !== undefined
  const damaged = present && (entry.condition ?? 'intact') === 'damaged'
  return { present, damaged, operational: present && !damaged }
}

// ---------------------------------------------------------------------------
// Mech patch (restore + repair + recharge)
// ---------------------------------------------------------------------------

/** The 'Chassis Damaged' condition label written by the Critical Damage flow. */
export const CHASSIS_DAMAGED_CONDITION = 'Chassis Damaged'

/** Resolve an installed system/module slug to its Tech Level. */
function installedItemTechLevel(ref: string): number | undefined {
  const item = resolveInstalledRef(ref)
  return typeof item?.techLevel === 'number' ? item.techLevel : undefined
}

/** Resolve the mech's chassis Tech Level from its `chassisRef` slug. */
function chassisTechLevel(chassisRef: string): number | undefined {
  const chassis = resolveChassisRef(chassisRef)
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
 *
 * `mechBay` gates restore + repair (p.221: a Damaged — or missing — Mech Bay
 * blocks both; Uses still recharge, that is Downtime rest, not the bay).
 * Omitted = assume operational, for callers outside the crawler context.
 */
export function downtimeMechPatch(
  mech: Mech,
  crawlerTl: number,
  steps: DowntimeSteps,
  mechBay?: Pick<MechBayStatus, 'operational'>
): Partial<Mech> {
  if (mech.destroyed) return {}
  const patch: Partial<Mech> = {}
  const bayOperational = mechBay?.operational ?? true

  if (steps.restoreMechs && bayOperational) {
    const maxSP = mechMaxSP(mech)
    const maxEP = mechMaxEP(mech)
    if (mech.currentSP !== undefined && mech.currentSP !== maxSP) patch.currentSP = maxSP
    if (mech.currentEP !== undefined && mech.currentEP !== maxEP) patch.currentEP = maxEP
    if (resolveGauge(mech.currentHeat) !== 0) patch.currentHeat = 0
  }

  if (steps.repairItems && bayOperational) {
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
export const NEVER_RECHARGE_EQUIPMENT = ['orbital-lance-controller'] as const

/** True when an equipmentUses key (an equipment slug) is a never-recharge item. */
function isNeverRecharge(ref: string): boolean {
  return NEVER_RECHARGE_EQUIPMENT.some((slug) => slug === ref)
}

/**
 * The Downtime patch for one pilot. Only fields that actually change are
 * included — an empty patch means "skip the write".
 *
 * Ordering matters: injuries heal FIRST, then HP restores to the max derived
 * from the injuries that remain — healing a Minor Injury at a Tech 3 Med Bay
 * restores the pilot to the recovered maximum in one pass.
 *
 * `crawlerTechLevel` is the pilot's effective crawler tier
 * (`resolveEffectiveCrawlerLevel`) — it raises max HP/AP via Stat Training, so
 * rest restores to the same maximum the sheet shows. Absent = Tech 1.
 */
export function downtimePilotPatch(
  pilot: Pilot,
  medBay: MedBayStatus,
  steps: DowntimeSteps,
  crawlerTechLevel?: number
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
    const maxAP = Math.max(0, pilotMaxAP({ ...pilot, crawlerTechLevel }))
    if (pilot.currentAP !== undefined && pilot.currentAP !== maxAP) patch.currentAP = maxAP
    if (medBay.operational) {
      const maxHP = Math.max(
        0,
        pilotMaxHP({ ...pilot, injuries: remainingInjuries, crawlerTechLevel })
      )
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
