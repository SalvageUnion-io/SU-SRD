/**
 * mechItems — pure helpers for the mech sheet's per-item action economy
 * (Repair: "damaged → Intact for half
 * Salvage Value in Scrap (min 1, Scrap TL ≥ item)").
 *
 * Everything here is pure (no React, no store): the MechSheet wires the
 * results to persistence, MechItemCard renders them.
 */

import type { ItemCondition } from 'game-domain/schemas/itemCondition'
import type { Mech } from 'game-domain/schemas/mech'
import type { RefMetaAction, RefModule, RefSystem } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { halfSalvageValue, resolveModuleRef, resolveSystemRef } from 'salvageunion-reference/rules'

export type MechItem = RefSystem | RefModule

/** Installed system/module refs are slugs (`escape-hatch`), resolved by the package (ADR-006). */
export function resolveSystem(slug: string): RefSystem | null {
  return resolveSystemRef(slug)
}

export function resolveModule(slug: string): RefModule | null {
  return resolveModuleRef(slug)
}

/**
 * What one activation of this item costs / produces, mined from its resolved
 * actions: `epCost` from the primary action's numeric activation cost
 * (systems/modules cost EP), `heat` from the primary action's Hot (X) traits,
 * `maxUses` as the largest Uses (X) trait across all actions (0 = the item
 * carries no uses counter).
 */
export type MechItemEconomy = {
  epCost: number
  heat: number
  maxUses: number
}

function traitAmount(trait: { amount?: unknown }): number {
  return typeof trait.amount === 'number' ? trait.amount : 0
}

function itemActions(entity: MechItem): RefMetaAction[] {
  return SalvageUnionReference.resolveActions(entity) ?? []
}

/**
 * The one per-action reducer: EP/AP from the activation cost, Heat from Hot
 * (each trait its printed amount, min 1; a variable Hot 'X' uses `hotX` when
 * given, clamped at 0), uses from the largest Uses trait.
 */
export function actionEconomy(action: RefMetaAction, hotX?: number): MechItemEconomy {
  const traits = action.traits ?? []
  const epCost = typeof action.activationCost === 'number' ? action.activationCost : 0
  const heat = traits
    .filter((t) => t.type === 'hot')
    .reduce(
      (sum, t) =>
        sum +
        (t.amount === 'X' && hotX !== undefined ? Math.max(0, hotX) : Math.max(1, traitAmount(t))),
      0
    )
  const maxUses = traits
    .filter((t) => t.type === 'uses')
    .reduce((m, t) => Math.max(m, traitAmount(t)), 0)
  return { epCost, heat, maxUses }
}

/**
 * The item's economy: its primary action's (the first with a numeric
 * activation cost, else the first), with `maxUses` the largest across all.
 */
export function itemEconomy(entity: MechItem): MechItemEconomy {
  const actions = itemActions(entity)
  const primary = actions.find((a) => typeof a.activationCost === 'number') ?? actions[0]
  const base = primary ? actionEconomy(primary) : { epCost: 0, heat: 0, maxUses: 0 }
  const maxUses = Math.max(0, ...actions.map((a) => actionEconomy(a).maxUses))
  return { ...base, maxUses }
}

/** Uses left on an item: the stored count, capped at its max; 0 when it has no uses counter. */
export function itemUsesRemaining(maxUses: number, usesRemaining: number | undefined): number {
  return maxUses > 0 ? Math.min(usesRemaining ?? maxUses, maxUses) : 0
}

/**
 * Field-repair cost: half Salvage Value in Scrap, rounded DOWN, minimum 1.
 *
 * The book states the cost with no rounding of its own — "an amount of Scrap
 * equal to half its Salvage Value" (Core Book p.221, Union Crawler Mech Bay)
 * and "half its Salvage Value to a minimum of 1" (p.248, the Repair ability).
 * Neither says round up, so the general rule governs: "In any situation where
 * you need to round a number, always round down unless stated otherwise"
 * (p.233), immediately followed by "Specific beats general".
 */
export function repairScrapCost(salvageValue: number | undefined): number {
  return halfSalvageValue(salvageValue ?? 1)
}

/** Manual status-badge cycle: Intact → Damaged → Destroyed → Intact. */
export function cycleCondition(condition: ItemCondition): ItemCondition {
  if (condition === 'intact') return 'damaged'
  if (condition === 'damaged') return 'destroyed'
  return 'intact'
}

type MechConditionState = Pick<Mech, 'conditions' | 'shutdown' | 'vulnerable' | 'destroyed'>

const FLAG_LABELS = ['shutdown', 'vulnerable', 'destroyed'] as const
type FlagLabel = (typeof FLAG_LABELS)[number]

/**
 * Patch for the unified mech conditions editor: the
 * editor edits the `unifiedMechConditions()` list, and this maps the edited
 * list back onto the two storage forms — removing a flag-backed label
 * ('Shutdown' / 'Vulnerable' / 'Destroyed') clears the automation-written
 * boolean flag (the manual clear); every other label lands in
 * `conditions[]`. Labels still backed by a true flag are kept OUT of
 * `conditions[]` so the two forms never double-store one condition.
 */
export function mechConditionsPatch(prev: MechConditionState, next: string[]): Partial<Mech> {
  const nextLower = new Set(next.map((c) => c.trim().toLowerCase()))
  const patch: Partial<Mech> = {}

  const flagStillTrue: Record<FlagLabel, boolean> = {
    shutdown: prev.shutdown === true,
    vulnerable: prev.vulnerable === true,
    destroyed: prev.destroyed === true,
  }
  for (const flag of FLAG_LABELS) {
    if (flagStillTrue[flag] && !nextLower.has(flag)) {
      patch[flag] = false
      flagStillTrue[flag] = false
    }
  }

  patch.conditions = next.filter((c) => {
    const lower = c.trim().toLowerCase()
    return !FLAG_LABELS.some((flag) => flag === lower && flagStillTrue[flag])
  })
  return patch
}
