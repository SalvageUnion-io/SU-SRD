/**
 * The Downtime step box's plan (play.md §6): what the current step will apply,
 * line by line, read from the pure patches in `cantina-domain/rules/downtime`
 * (`downtimeMechPatch`, `downtimePilotPatch`) and the Upkeep rule. Each line
 * names the Downtime step keys it governs, so unticking it leaves them out
 * (ADR-007: every step skippable). Pure: no React, no store.
 */

import type { DowntimeStepKey, DowntimeSteps, MedBayStatus } from 'cantina-domain/rules/downtime'
import {
  DOWNTIME_UPKEEP_SCRAP,
  downtimeMechPatch,
  downtimePilotPatch,
  mechBayStatus,
  medBayStatus,
} from 'cantina-domain/rules/downtime'
import type { Crawler } from 'cantina-domain/schemas/crawler'
import type { Mech } from 'cantina-domain/schemas/mech'
import type { Pilot } from 'cantina-domain/schemas/pilot'
import {
  mechMaxEP,
  mechMaxSP,
  pilotMaxAP,
  pilotMaxHP,
  resolveGauge,
  resolvePool,
} from 'salvageunion-reference/rules'
import { crawlerTechLevelOf } from '../../lib/rules/downtimeEconomy'
import { resolveModule, resolveSystem } from '../../lib/rules/mechItems'
import { resolveEquipment } from '../../lib/rules/pilotInventory'

/** No crawler: no Med Bay to heal HP or injuries (AP still rests). */
const NO_MED_BAY: MedBayStatus = {
  present: false,
  damaged: false,
  operational: false,
  healsMinor: false,
  healsMajor: false,
}

/** One label-first chip on a line: `SP | 14→20`, or a label alone (`Paid`). */
type PlanChip = { label: string; value?: string }

export type PlanLine = {
  key: 'mech' | 'pilot' | 'uses' | 'resets' | 'train' | 'upkeep'
  /** The unit or thing it applies to: "Buzzard", "Uses recharge". */
  title: string
  chips: PlanChip[]
  /** The Downtime step keys the line governs (none for Upkeep). */
  steps: DowntimeStepKey[]
  /** Whether the reader may untick it; a line only read (Upkeep, someone else's) may not. */
  skippable: boolean
  /** Why nothing on this line applies (a damaged bay), shown in place of its chips. */
  blocked?: string
}

export type StepPlanInput = {
  /** The guide step's name ("Restore your Mech & Pilot"). */
  stepName: string
  pilot: Pilot | null
  mech: Mech | null
  crawler: Crawler | null
  /** The pilot's effective crawler Tech Level (Stat Training raises max HP/AP). */
  pilotCrawlerTl: number
  /** Upkeep: whether it is paid this Downtime, and whether this reader pays it. */
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

/** The crawler's Tech Level for repairs, Tech 1 with none. */
export function crawlerTl(crawler: Crawler | null): number {
  return (crawler ? crawlerTechLevelOf(crawler) : undefined) ?? 1
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

function mechLine(mech: Mech, crawler: Crawler | null): PlanLine | null {
  const steps: DowntimeStepKey[] = ['restoreMechs', 'repairItems']
  const bay = mechBayOf(crawler)
  if (bay && !bay.operational) {
    return {
      key: 'mech',
      title: mech.name,
      chips: [],
      steps,
      skippable: false,
      blocked: 'Mech Bay damaged: no restore or repair this Downtime',
    }
  }
  const patch = downtimeMechPatch(mech, crawlerTl(crawler), onlySteps(steps), bay)
  const chips: PlanChip[] = []
  if (patch.currentSP !== undefined)
    chips.push({
      label: 'SP',
      value: arrow(resolvePool(mech.currentSP, mechMaxSP(mech)), patch.currentSP),
    })
  if (patch.currentEP !== undefined)
    chips.push({
      label: 'EP',
      value: arrow(resolvePool(mech.currentEP, mechMaxEP(mech)), patch.currentEP),
    })
  if (patch.currentHeat !== undefined)
    chips.push({ label: 'Heat', value: arrow(resolveGauge(mech.currentHeat), patch.currentHeat) })
  const repaired = (next: Mech['systemConditions'], was: Mech['systemConditions']) =>
    Object.entries(next ?? {}).filter(([ref, c]) => c === 'intact' && was?.[ref] === 'damaged')
      .length
  const fixed =
    repaired(patch.systemConditions, mech.systemConditions) +
    repaired(patch.moduleConditions, mech.moduleConditions) +
    (patch.conditions ? 1 : 0)
  if (fixed > 0) chips.push({ label: 'Repairs', value: String(fixed) })
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
    chips.push({ label: 'Injuries healed', value: String(healed) })
  }
  if (chips.length === 0) return null
  return { key: 'pilot', title: pilot.name, chips, steps, skippable: true }
}

function usesLine(pilot: Pilot | null, mech: Mech | null, crawler: Crawler | null, tl: number) {
  const steps: DowntimeStepKey[] = ['rechargeUses']
  const chips: PlanChip[] = []
  if (mech) {
    const patch = downtimeMechPatch(mech, crawlerTl(crawler), onlySteps(steps), mechBayOf(crawler))
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
  const line: PlanLine = { key: 'uses', title: 'Uses recharge', chips, steps, skippable: true }
  return line
}

function resetsLine(pilot: Pilot, crawler: Crawler | null, tl: number): PlanLine | null {
  const steps: DowntimeStepKey[] = ['clearUsed']
  const patch = downtimePilotPatch(pilot, medBayOf(crawler), onlySteps(steps), tl)
  const chips: PlanChip[] = []
  if (patch.usedAbilities !== undefined)
    chips.push({ label: 'Abilities used', value: arrow((pilot.usedAbilities ?? []).length, 0) })
  if (patch.usedToggles !== undefined) chips.push({ label: 'Once per Downtime', value: 'reset' })
  if (chips.length === 0) return null
  return { key: 'resets', title: 'Once-per-Downtime resets', chips, steps, skippable: true }
}

/**
 * What the step will apply, line by line; empty when the step applies
 * nothing (the table does it: Tally Salvage, Trade, Craft, the rumours).
 */
export function stepPlan(input: StepPlanInput): PlanLine[] {
  const { stepName, pilot, mech, crawler, pilotCrawlerTl, upkeep } = input
  const lines: (PlanLine | null)[] = []
  if (stepName === 'Restore your Mech & Pilot') {
    if (mech) lines.push(mechLine(mech, crawler))
    if (pilot) lines.push(pilotLine(pilot, crawler, pilotCrawlerTl))
    lines.push(usesLine(pilot, mech, crawler, pilotCrawlerTl))
    if (pilot) lines.push(resetsLine(pilot, crawler, pilotCrawlerTl))
  } else if (stepName === 'Train your Pilot' && pilot) {
    const tp = pilot.trainingPoints ?? 0
    lines.push({
      key: 'train',
      title: pilot.name,
      chips: [{ label: 'TP', value: arrow(tp, tp + 1) }],
      steps: ['trainPilots'],
      skippable: true,
    })
  } else if (stepName === 'Upkeep & Upgrade' && crawler) {
    lines.push({
      key: 'upkeep',
      title: 'Upkeep',
      chips: [
        {
          label: 'Upkeep',
          value: `${DOWNTIME_UPKEEP_SCRAP} Scrap · T${crawlerTl(crawler)}`,
        },
        { label: upkeep.spent ? 'Paid' : upkeep.canPay ? 'Outstanding' : 'The Mediator pays it' },
      ],
      steps: [],
      skippable: upkeep.canPay && !upkeep.spent,
    })
  }
  return lines.filter((line): line is PlanLine => line !== null)
}

/** The Downtime steps the ticked lines switch on. */
export function stepsFor(lines: readonly PlanLine[], unticked: ReadonlySet<string>): DowntimeSteps {
  return onlySteps(lines.filter((l) => !unticked.has(l.key)).flatMap((l) => l.steps))
}
