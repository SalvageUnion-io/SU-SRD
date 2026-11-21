/**
 * Rule breaks — a count over the cap its rule sets, on a Live Sheet. Free
 * Edit never blocks one (surfaces §1): the sheet saves, marks the broken stat
 * and says at the save what broke and by how much. This module only counts;
 * the mark is `RuleBreakMark` and the words are the sheet's.
 *
 * A Tech Level above the mech's is no rule break: the book limits what a
 * crawler can craft, not what a chassis mounts.
 */

import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import { computeMechCapacity, mechMaxCargo } from 'salvageunion-reference/rules'
import { carrierCargoUsage } from '../cargo/cargoTransfer'
import { pilotInventoryCapacity, pilotInventoryUsed } from './pilotInventory'

export type RuleBreakStat = 'systemSlots' | 'moduleSlots' | 'cargoCapacity' | 'inventorySlots'

/** One stat over its cap: `used` of `max`, `used - max` over. */
export type RuleBreak = { stat: RuleBreakStat; used: number; max: number }

const over = (stat: RuleBreakStat, used: number, max: number): RuleBreak[] =>
  used > max ? [{ stat, used, max }] : []

/** A hold's Cargo over its capacity. */
export function cargoRuleBreaks(usage: { used: number; cap: number }): RuleBreak[] {
  return over('cargoCapacity', usage.used, usage.cap)
}

/**
 * A mech's slot counts over its chassis's, and its Cargo over its capacity.
 * The book's own printed loadout breaks no slot rule. `abilities` are the
 * assigned pilot's: one of them can raise the mech's Cargo Capacity (ADR-029).
 */
export function mechRuleBreaks(
  mech: Pick<Mech, 'chassisRef' | 'systems' | 'modules'> &
    Partial<Pick<Mech, 'cargoLots' | 'maxCargoOverride'>>,
  abilities?: string[]
): RuleBreak[] {
  const capacity = computeMechCapacity({
    chassisRef: mech.chassisRef,
    systems: mech.systems.map((ref) => ({ ref })),
    modules: mech.modules.map((ref) => ({ ref })),
  })
  // An unresolved chassis has no cap to break.
  if (capacity.violations.some((v) => v.kind === 'chassis-not-found')) return []
  const cargo = cargoRuleBreaks(
    carrierCargoUsage(mech.cargoLots ?? [], mechMaxCargo(mech, undefined, { abilities }))
  )
  // A printed pattern's slot count is the book's.
  if (capacity.asPrinted) return cargo
  return [
    ...over('systemSlots', capacity.systemSlotsUsed, capacity.systemSlotsMax),
    ...over('moduleSlots', capacity.moduleSlotsUsed, capacity.moduleSlotsMax),
    ...cargo,
  ]
}

/** A pilot's inventory over its slots. */
export function pilotRuleBreaks(pilot: Pilot): RuleBreak[] {
  return over('inventorySlots', pilotInventoryUsed(pilot), pilotInventoryCapacity(pilot))
}

/**
 * The breaks an edit made or made worse: those of `after` that `before` did
 * not have, or had by less. An edit that leaves a break as it was, or eases
 * it, says nothing.
 */
export function ruleBreaksMade(
  before: readonly RuleBreak[],
  after: readonly RuleBreak[]
): RuleBreak[] {
  return after.filter((now) => {
    const was = before.find((b) => b.stat === now.stat)
    return !was || now.used - now.max > was.used - was.max
  })
}
