/**
 * The Units column's pure half (play.md §4): which units are live, what the
 * current Downtime step will restore on the mech, the crawler's bay chips,
 * and the mechs left in the hangar. No React and no I/O.
 *
 * A live unit gets − / + on every vital and writes through `entityStore.update`;
 * a reference unit is dashed and read-only. The pilot is always live, the mech
 * only while Boarded, the crawler only in solo Downtime or for the Mediator.
 * "Live" is also "may write now": offline, or for a unit this browser does not
 * hold (a crewmate's mech, a Game crawler only the listing carries), nothing is.
 */

import {
  allDowntimeSteps,
  downtimeGuideSteps,
  downtimeMechPatch,
  mechBayStatus,
} from 'game-domain/rules/downtime'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import { crawlerTechLevelOf } from '../lib/rules/downtimeEconomy'
import type { BoardOption } from './boardMenu.model'
import type { Situation } from './situation.model'
import { bayConditions } from './unitStats.model'

/** Which units take − / + right now. */
export type UnitLiveness = { pilot: boolean; mech: boolean; crawler: boolean }

/**
 * The live rules (play.md §4), each also gated on writes being allowed and
 * on the store holding the unit (a unit the store does not hold has nowhere
 * to write).
 */
export function unitLiveness({
  situation,
  solo,
  mediator,
  canWrite,
  mechHeld,
  crawlerHeld,
}: {
  situation: Situation
  /** The pilot plays from the shelf (no Game). */
  solo: boolean
  /** The viewer mediates the pilot's Game. */
  mediator: boolean
  canWrite: boolean
  /** The store holds the mech the column shows. */
  mechHeld: boolean
  /** The store holds the crawler the column shows. */
  crawlerHeld: boolean
}): UnitLiveness {
  return {
    pilot: canWrite,
    mech: canWrite && mechHeld && situation === 'boarded',
    crawler: canWrite && crawlerHeld && ((solo && situation === 'downtime') || mediator),
  }
}

/** The Downtime guide step whose patches restore a mech (Workshop Manual p.228). */
export const RESTORE_STEP_NAME = 'Restore your Mech & Pilot'

/** What the step will set each mech vital to; a vital the step leaves alone is absent. */
export type MechRestore = { sp?: number; ep?: number; heat?: number }

/**
 * What the current Downtime step will restore on the mech, from the pure
 * patch the Downtime step box applies (`downtimeMechPatch`): nothing unless
 * the step is "Restore your Mech & Pilot". A damaged or missing Mech Bay
 * restores nothing (p.221); with no crawler at all, the bay is assumed whole
 * and the crawler Tech 1, as the patch itself assumes.
 */
export function mechRestorePreview(
  mech: Mech,
  crawler: Pick<Crawler, 'crawlerBays' | 'techLevel'> | null,
  stepIndex: number | null
): MechRestore {
  if (stepIndex === null) return {}
  if (downtimeGuideSteps()[stepIndex]?.name !== RESTORE_STEP_NAME) return {}
  const patch = downtimeMechPatch(
    mech,
    crawler === null ? 1 : (crawlerTechLevelOf(crawler) ?? 1),
    allDowntimeSteps(),
    crawler === null ? undefined : mechBayStatus(crawler)
  )
  return {
    ...(patch.currentSP === undefined ? {} : { sp: patch.currentSP }),
    ...(patch.currentEP === undefined ? {} : { ep: patch.currentEP }),
    ...(patch.currentHeat === undefined ? {} : { heat: patch.currentHeat }),
  }
}

/** One bay chip: its name, and whether it is damaged. */
export type BayChip = { name: string; damaged: boolean }

/**
 * The crawler's bays as its box shows them: every one (a chip is never
 * dropped for room, C3), damaged ones first, then the rest in the crawler's
 * order.
 */
export function bayChips(crawler: Crawler): BayChip[] {
  const bays = bayConditions(crawler).map(({ name, damaged }) => ({ name, damaged }))
  return [...bays.filter((b) => b.damaged), ...bays.filter((b) => !b.damaged)]
}

/**
 * The pilot's other mechs, as the hangar lists them: those Board offers that
 * are the pilot's own (in a Game, a crewmate's mech or an unclaimed spare is
 * the Board menu's, not this hangar's), less the one the column already shows.
 */
export function hangarMechs(options: readonly BoardOption[], shownId: string | null) {
  return options.filter(
    (option) =>
      option.mechId !== shownId && (option.state === 'yours' || option.state === 'destroyed')
  )
}

/** A − / + press: one step, never below 0 or above the max. */
export function nudge(value: number, by: number, max: number): number {
  return Math.min(Math.max(0, max), Math.max(0, value + by))
}
