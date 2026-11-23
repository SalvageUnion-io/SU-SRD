import { crawlerTechLevelOf } from 'game-domain/crawlerLevel'
import { hasCondition } from 'game-domain/mechConditions'
import { pilotLabel } from 'game-domain/pilotLabel'
/**
 * The Downtime step box's plan (play.md §6): what the current step will apply,
 * line by line, read from the pure patches in `game-domain/rules/downtime`
 * (`downtimeMechPatch`, `downtimePilotPatch`) and the Upkeep rule. Each line
 * names the Downtime step keys it governs, so unticking it leaves them out
 * (ADR-007: every step skippable). Pure: no React, no store.
 */

import { mechMaxima } from 'game-domain/rules/crewStatus'
import type { DowntimeStepKey, DowntimeSteps, MedBayStatus } from 'game-domain/rules/downtime'
import {
  CHASSIS_DAMAGED_CONDITION,
  CRAFT_STEP_NAME,
  downtimeMechPatch,
  downtimePilotPatch,
  mechBayStatus,
  medBayStatus,
  RESTORE_STEP_NAME,
  TRAIN_STEP_NAME,
  UPKEEP_STEP_NAME,
} from 'game-domain/rules/downtime'
import type { ScrapByTl } from 'game-domain/rules/tallyScrap'
import { mechScrap, pilotScrap, scrapCount, sumScrap } from 'game-domain/rules/tallyScrap'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import {
  crawlerUpkeepCost,
  pilotMaxAP,
  pilotMaxHP,
  resolveGauge,
  resolvePool,
} from 'salvageunion-reference/rules'
import { resolveModule, resolveSystem } from '../lib/rules/mechItems'
import { resolveEquipment } from '../lib/rules/pilotInventory'
import { playCopy } from '../messages/play'
import { naniteStatus } from './playNanites.model'
import { upkeepShort } from './playUpkeep.model'

/** No crawler: no Med Bay to heal HP or injuries (AP still rests). */
const NO_MED_BAY: MedBayStatus = {
  present: false,
  damaged: false,
  operational: false,
  healsMinor: false,
  healsMajor: false,
}

/** One label-first chip on a line: `SP | 14→20`, or a label alone (`Paid`). */
export type PlanChip = { label: string; value?: string }

export type PlanLine = {
  key: 'mech' | 'pilot' | 'uses' | 'resets' | 'train' | 'upkeep' | 'nanites' | 'scrap'
  /** The unit or thing it applies to: "Buzzard", "Uses recharge". */
  title: string
  chips: PlanChip[]
  /** The Downtime step keys the line governs (none for Upkeep or Nanites). */
  steps: DowntimeStepKey[]
  /** Whether the reader may untick it; a line only read (Upkeep, someone else's) may not. */
  skippable: boolean
  /** Why nothing on this line applies (a damaged bay), shown in place of its chips. */
  blocked?: string
  /** A line under its chips: where the book covers what the chips say (unpaid Upkeep). */
  note?: string
  /** What the line lacks is a Union Crawler: solo, the step links to making one (r5 A12). */
  needsCrawler?: boolean
}

export type StepPlanInput = {
  /** The guide step's name ("Restore your Mech & Pilot"). */
  stepName: string
  pilot: Pilot | null
  mech: Mech | null
  crawler: Crawler | null
  /** The pilot's effective crawler Tech Level (Stat Training raises max HP/AP). */
  pilotCrawlerTl: number
  /**
   * Upkeep: whether it is paid this Downtime, and whether this reader pays it.
   * Whoever pays the crawler's Upkeep also processes its Nanites.
   */
  upkeep: { spent: boolean; canPay: boolean }
}

/** Every step off: a line switches its own on. */
function noDowntimeSteps(): DowntimeSteps {
  return {
    restoreMechs: false,
    repairItems: false,
    healPilots: false,
    healInjuries: false,
    trainPilots: false,
    rechargeUses: false,
    clearUsed: false,
  }
}

/** Only these steps on. */
function onlySteps(keys: readonly DowntimeStepKey[]): DowntimeSteps {
  const steps = noDowntimeSteps()
  for (const key of keys) steps[key] = true
  return steps
}

/** The crawler's Med Bay this Downtime, none without a crawler. */
export function medBayOf(crawler: Crawler | null): MedBayStatus {
  return crawler ? medBayStatus(crawler) : NO_MED_BAY
}

/** The crawler's Mech Bay gate; without a crawler, assumed operational. */
export function mechBayOf(crawler: Crawler | null): { operational: boolean } | undefined {
  return crawler ? mechBayStatus(crawler) : undefined
}

const arrow = (from: number, to: number) => `${from}→${to}`

/** The Reactor's conditions Restore clears (r7 D2), as the unit card names them. */
const REACTOR_RESTS = ['Shutdown', 'Vulnerable'] as const

function mechLine(mech: Mech, pilot: Pilot | null, crawler: Crawler | null): PlanLine | null {
  const steps: DowntimeStepKey[] = ['restoreMechs', 'repairItems']
  const bay = mechBayOf(crawler)
  if (bay && !bay.operational) {
    return {
      key: 'mech',
      title: mech.name,
      chips: [],
      steps,
      skippable: false,
      blocked: playCopy('mechBayDamagedNoRestore'),
    }
  }
  const patch = downtimeMechPatch(
    mech,
    pilot?.abilities,
    crawlerTechLevelOf(crawler),
    onlySteps(steps),
    bay
  )
  const { maxSP, maxEP } = mechMaxima(mech, pilot?.abilities, [])
  const chips: PlanChip[] = []
  if (patch.currentSP !== undefined)
    chips.push({ label: 'SP', value: arrow(resolvePool(mech.currentSP, maxSP), patch.currentSP) })
  if (patch.currentEP !== undefined)
    chips.push({ label: 'EP', value: arrow(resolvePool(mech.currentEP, maxEP), patch.currentEP) })
  if (patch.currentHeat !== undefined)
    chips.push({ label: 'Heat', value: arrow(resolveGauge(mech.currentHeat), patch.currentHeat) })
  const repaired = (next: Mech['systemConditions'], was: Mech['systemConditions']) =>
    Object.entries(next ?? {}).filter(([ref, c]) => c === 'intact' && was?.[ref] === 'damaged')
      .length
  const cleared = (label: string) =>
    patch.conditions !== undefined &&
    hasCondition(mech.conditions, label) &&
    !hasCondition(patch.conditions, label)
  const fixed =
    repaired(patch.systemConditions, mech.systemConditions) +
    repaired(patch.moduleConditions, mech.moduleConditions) +
    (cleared(CHASSIS_DAMAGED_CONDITION) ? 1 : 0)
  if (fixed > 0) chips.push({ label: 'Repairs', value: String(fixed) })
  // The Reactor's conditions, by the names the unit card shows them (r7 D2).
  for (const label of REACTOR_RESTS)
    if (cleared(label)) chips.push({ label, value: playCopy('clears') })
  if (chips.length === 0) return null
  return { key: 'mech', title: mech.name, chips, steps, skippable: true }
}

function pilotLine(pilot: Pilot, crawler: Crawler | null, tl: number): PlanLine | null {
  const steps: DowntimeStepKey[] = ['healPilots', 'healInjuries']
  const patch = downtimePilotPatch(pilot, medBayOf(crawler), onlySteps(steps), tl)
  const chips: PlanChip[] = []
  if (patch.currentHP !== undefined)
    chips.push({
      label: 'HP',
      value: arrow(
        resolvePool(pilot.currentHP, pilotMaxHP({ ...pilot, crawlerTechLevel: tl })),
        patch.currentHP
      ),
    })
  if (patch.currentAP !== undefined)
    chips.push({
      label: 'AP',
      value: arrow(
        resolvePool(pilot.currentAP, pilotMaxAP({ ...pilot, crawlerTechLevel: tl })),
        patch.currentAP
      ),
    })
  if (patch.injuries !== undefined) {
    const healed = (pilot.injuries ?? []).length - patch.injuries.length
    chips.push({ label: playCopy('injuriesHealed'), value: String(healed) })
  }
  // HP heals at a Med Bay alone (Core Book p.223): with none, or a damaged
  // one, the line says the HP stays, never leaves it out in silence (r5 A12).
  const unhealed = unhealedNote(pilot, crawler, tl)
  const title = pilotLabel(pilot)
  if (chips.length === 0)
    return unhealed === null
      ? null
      : { key: 'pilot', title, chips, steps, skippable: false, ...unhealed }
  return {
    key: 'pilot',
    title,
    chips,
    steps,
    skippable: true,
    ...(unhealed === null ? {} : { note: unhealed.blocked, needsCrawler: unhealed.needsCrawler }),
  }
}

/** Why a hurt pilot's HP stays where it is this Downtime; null when it heals, or is full. */
function unhealedNote(
  pilot: Pilot,
  crawler: Crawler | null,
  tl: number
): { blocked: string; needsCrawler: boolean } | null {
  const medBay = medBayOf(crawler)
  if (medBay.operational) return null
  const maxHP = pilotMaxHP({ ...pilot, crawlerTechLevel: tl })
  const hp = resolvePool(pilot.currentHP, maxHP)
  if (hp >= maxHP) return null
  return { blocked: playCopy('hpStays', { hp }), needsCrawler: crawler === null }
}

/**
 * Restore's own first line where a hurt pilot cannot heal (r6 D7): why, with
 * its page, before the lines and above the quoted general rule. Null on any
 * other step, with an operational Med Bay, or a pilot at full HP.
 */
export function restoreLead(
  input: Pick<StepPlanInput, 'stepName' | 'pilot' | 'crawler' | 'pilotCrawlerTl'>
): string | null {
  const { stepName, pilot, crawler, pilotCrawlerTl } = input
  if (stepName !== RESTORE_STEP_NAME || pilot === null) return null
  if (unhealedNote(pilot, crawler, pilotCrawlerTl) === null) return null
  return playCopy(medBayOf(crawler).damaged ? 'healingMedBayDamaged' : 'healingNeedsMedBay')
}

/** The steps a second Restore runs: the Med Bay's healing, and nothing else. */
const HEAL_STEPS: DowntimeStepKey[] = ['healPilots', 'healInjuries']

/**
 * Restore, once taken: what a Med Bay that has arrived since would heal (a
 * second run, `healAgain`), or why the HP still stays. Null on any other
 * step, and once the pilot is healed (r5 A12).
 */
export function restoreAgainLine(input: StepPlanInput): PlanLine | null {
  const { stepName, pilot, crawler, pilotCrawlerTl: tl } = input
  if (stepName !== RESTORE_STEP_NAME || pilot === null) return null
  const line = pilotLine(pilot, crawler, tl)
  if (line === null) return null
  if (!medBayOf(crawler).operational) {
    const blocked = line.blocked ?? line.note
    if (blocked === undefined) return null
    const needsCrawler = line.needsCrawler ?? false
    return {
      key: 'pilot',
      title: line.title,
      chips: [],
      steps: [],
      skippable: false,
      blocked,
      needsCrawler,
    }
  }
  const chips = line.chips.filter((chip) => chip.label !== 'AP')
  return chips.length === 0 ? null : { ...line, chips }
}

/** What the second Restore applies to the pilot: the healing alone. */
export function healAgainPatch(pilot: Pilot, crawler: Crawler | null, tl: number): Partial<Pilot> {
  return downtimePilotPatch(pilot, medBayOf(crawler), onlySteps(HEAL_STEPS), tl)
}

function usesLine(pilot: Pilot | null, mech: Mech | null, crawler: Crawler | null, tl: number) {
  const steps: DowntimeStepKey[] = ['rechargeUses']
  const chips: PlanChip[] = []
  if (mech) {
    const patch = downtimeMechPatch(
      mech,
      pilot?.abilities,
      crawlerTechLevelOf(crawler),
      onlySteps(steps),
      mechBayOf(crawler)
    )
    if (patch.itemUses !== undefined) {
      for (const [slug, left] of Object.entries(mech.itemUses ?? {})) {
        const name = resolveSystem(slug)?.name ?? resolveModule(slug)?.name ?? slug
        chips.push({ label: name, value: `${left}→full` })
      }
    }
  }
  if (pilot) {
    const patch = downtimePilotPatch(pilot, medBayOf(crawler), onlySteps(steps), tl)
    if (patch.equipmentUses !== undefined) {
      const kept = new Set(Object.keys(patch.equipmentUses))
      for (const [slug, left] of Object.entries(pilot.equipmentUses ?? {})) {
        if (kept.has(slug)) continue
        chips.push({ label: resolveEquipment(slug)?.name ?? slug, value: `${left}→full` })
      }
    }
  }
  if (chips.length === 0) return null
  const line: PlanLine = {
    key: 'uses',
    title: playCopy('usesRecharge'),
    chips,
    steps,
    skippable: true,
  }
  return line
}

function resetsLine(pilot: Pilot, crawler: Crawler | null, tl: number): PlanLine | null {
  const steps: DowntimeStepKey[] = ['clearUsed']
  const patch = downtimePilotPatch(pilot, medBayOf(crawler), onlySteps(steps), tl)
  const chips: PlanChip[] = []
  if (patch.usedAbilities !== undefined)
    chips.push({
      label: playCopy('abilitiesUsed'),
      value: arrow((pilot.usedAbilities ?? []).length, 0),
    })
  if (patch.usedToggles !== undefined)
    chips.push({ label: playCopy('oncePerDowntime'), value: 'reset' })
  if (chips.length === 0) return null
  return {
    key: 'resets',
    title: playCopy('oncePerDowntimeResets'),
    chips,
    steps,
    skippable: true,
  }
}

/**
 * The Nanite Processing Bay's line (False Flag p.66): every Inert pile rolls a
 * d20, a 20 an Active Meld Nanite. None without the bay, or with nothing to
 * process in an Intact one.
 */
function nanitesLine(crawler: Crawler, canProcess: boolean): PlanLine | null {
  const bay = naniteStatus(crawler)
  if (!bay.present) return null
  const title = playCopy('processNanites')
  if (bay.damaged)
    return {
      key: 'nanites',
      title,
      chips: [],
      steps: [],
      skippable: false,
      blocked: playCopy('naniteBayDamagedNoProcessing'),
    }
  if (bay.inert === 0) return null
  return {
    key: 'nanites',
    title,
    chips: [
      { label: playCopy('inertPiles'), value: String(bay.inert) },
      { label: canProcess ? playCopy('d20EachActiveOn20') : playCopy('theMediatorProcessesThem') },
    ],
    steps: [],
    skippable: canProcess,
  }
}

/**
 * What the step will apply, line by line; empty when the step applies
 * nothing (the table does it: Tally Salvage, Trade, Craft, the rumours).
 */
export function stepPlan(input: StepPlanInput): PlanLine[] {
  const { stepName, pilot, mech, crawler, pilotCrawlerTl, upkeep } = input
  const lines: (PlanLine | null)[] = []
  if (stepName === RESTORE_STEP_NAME) {
    if (mech) lines.push(mechLine(mech, pilot, crawler))
    if (pilot) lines.push(pilotLine(pilot, crawler, pilotCrawlerTl))
    lines.push(usesLine(pilot, mech, crawler, pilotCrawlerTl))
    if (pilot) lines.push(resetsLine(pilot, crawler, pilotCrawlerTl))
  } else if (stepName === TRAIN_STEP_NAME && pilot) {
    const tp = pilot.trainingPoints ?? 0
    lines.push({
      key: 'train',
      title: pilotLabel(pilot),
      chips: [{ label: 'TP', value: arrow(tp, tp + 1) }],
      steps: ['trainPilots'],
      skippable: true,
    })
  } else if (stepName === UPKEEP_STEP_NAME && crawler) {
    // A pool too small pays nothing: the line reads Short by N for everyone (r4 A7).
    const short = upkeep.spent ? 0 : upkeepShort(crawler)
    lines.push({
      key: 'upkeep',
      title: 'Upkeep',
      chips: [
        {
          label: 'Upkeep',
          value: `${crawlerUpkeepCost(crawler.techLevel, crawler.type)} Scrap · T${crawler.techLevel}`,
        },
        {
          label: upkeep.spent
            ? 'Paid'
            : short > 0
              ? playCopy('shortBy', { short })
              : upkeep.canPay
                ? 'Outstanding'
                : playCopy('theMediatorPaysIt'),
        },
      ],
      steps: [],
      skippable: upkeep.canPay && !upkeep.spent && short === 0,
      ...(short > 0 ? { note: playCopy('unpaidUpkeepCite') } : {}),
    })
  } else if (stepName === CRAFT_STEP_NAME && crawler) {
    lines.push(nanitesLine(crawler, upkeep.canPay))
  }
  return lines.filter((line): line is PlanLine => line !== null)
}

/**
 * The steps up to `upTo` (0-based, inclusive) that preview a change this
 * pilot has not taken: skipped, never done (r4 A6). A step that applies
 * nothing (the table does it), and one taken with Skip or Apply, is not one.
 */
export function skippedSteps(
  input: Omit<StepPlanInput, 'stepName'> & {
    steps: readonly { name: string }[]
    upTo: number
    /** The steps this pilot has taken; null where no pilot takes any (the Mediator's screen). */
    taken: readonly number[] | null
  }
): number[] {
  const { steps, upTo, taken, ...units } = input
  if (taken === null) return []
  return steps.flatMap((step, index) =>
    index <= upTo &&
    !taken.includes(index) &&
    stepPlan({ ...units, stepName: step.name }).some((line) => line.skippable)
      ? [index]
      : []
  )
}

/**
 * The steps a move on from `from` to `to` left this pilot unfinished: the
 * skipped ones from `from` up. None on a Back, or a move that stayed (r5 A3).
 */
export function leftOnMove(from: number, to: number, skipped: readonly number[]): number[] {
  return to <= from ? [] : skipped.filter((i) => i >= from && i < to)
}

/** Steps by number and name, as a list reads them: "3 Restore your Mech & Pilot, 7 Train". */
export function stepNames(steps: readonly { name: string }[], indexes: readonly number[]): string {
  return indexes.map((i) => `${i + 1} ${steps[i]?.name ?? ''}`.trim()).join(', ')
}

/** The Downtime steps the ticked lines switch on. */
export function stepsFor(lines: readonly PlanLine[], unticked: ReadonlySet<string>): DowntimeSteps {
  return onlySteps(lines.filter((l) => !unticked.has(l.key)).flatMap((l) => l.steps))
}

/** Scrap by Tech Level as chips, lowest first: `T1 | 2`, `T2 | 3`. */
function scrapChips(tally: ScrapByTl): PlanChip[] {
  return Object.entries(tally)
    .filter(([, n]) => (n ?? 0) > 0)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([tl, n]) => ({ label: `T${tl}`, value: String(n) }))
}

/**
 * Tally Salvage's line (Core Book p.227, r6 D1): the Scrap this pilot carries
 * home, theirs and their mech's, by Tech Level. Null when they carry none.
 */
export function carriedScrap(
  pilot: Pilot | null,
  mech: Mech | null
): { tally: ScrapByTl; count: number; chips: PlanChip[] } | null {
  const tally = sumScrap(pilotScrap(pilot), mechScrap(mech))
  const count = scrapCount(tally)
  return count === 0 ? null : { tally, count, chips: scrapChips(tally) }
}
