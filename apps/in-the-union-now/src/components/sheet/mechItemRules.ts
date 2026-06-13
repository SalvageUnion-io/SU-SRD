/**
 * mechItemRules — pure helpers for the mech sheet's per-item action economy
 * (plan 4.5, S12; rules B10–B13 and Repair: "damaged → Intact for half
 * Salvage Value in Scrap (min 1, Scrap TL ≥ item)").
 *
 * Everything here is pure (no React, no store): the MechSheet wires the
 * results to persistence, MechItemCard renders them.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import type {
  SURefMetaAction,
  SURefMetaEntity,
  SURefModule,
  SURefSystem,
} from 'salvageunion-reference'

import { scrapPoolBucket } from '../../lib/cargo/cargoTransfer'
import type { ScrapPool } from '../../lib/schemas/crawler'
import type { ItemCondition, Mech } from '../../lib/schemas/mech'

export type MechItem = SURefSystem | SURefModule

export function resolveSystem(slug: string): SURefSystem | null {
  const all = SalvageUnionReference.Systems.all() as ReadonlyArray<SURefSystem>
  return all.find((s) => s.id === slug || s.name === slug) ?? null
}

export function resolveModule(slug: string): SURefModule | null {
  const all = SalvageUnionReference.Modules.all() as ReadonlyArray<SURefModule>
  return all.find((m) => m.id === slug || m.name === slug) ?? null
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

function itemActions(entity: MechItem): SURefMetaAction[] {
  return SalvageUnionReference.resolveActions(entity as unknown as SURefMetaEntity) ?? []
}

export function itemEconomy(entity: MechItem): MechItemEconomy {
  const actions = itemActions(entity)
  // The primary action drives the Use button: the first one with a numeric
  // activation cost, falling back to the first action.
  const primary = actions.find((a) => typeof a.activationCost === 'number') ?? actions[0]
  const epCost = typeof primary?.activationCost === 'number' ? primary.activationCost : 0
  const heat = (primary?.traits ?? [])
    .filter((t) => t.type === 'hot')
    .reduce((sum, t) => sum + Math.max(1, traitAmount(t)), 0)
  const maxUses = actions.reduce(
    (max, action) =>
      (action.traits ?? [])
        .filter((t) => t.type === 'uses')
        .reduce((m, t) => Math.max(m, traitAmount(t)), max),
    0
  )
  return { epCost, heat, maxUses }
}

/** Field-repair cost: half Salvage Value in Scrap, rounded up, min 1. */
export function repairScrapCost(salvageValue: number | undefined): number {
  return Math.max(1, Math.ceil((salvageValue ?? 1) / 2))
}

/**
 * The crawler scrap-pool bucket a repair could deduct from: the LOWEST tech
 * level ≥ the item's TL whose bucket holds at least `cost` (Scrap TL must be
 * ≥ item TL; higher-TL scrap is allowed). Returns null when no bucket
 * qualifies — the repair still proceeds without a deduction (advisory,
 * never blocks — S12).
 */
export function repairPoolTl(
  pool: ScrapPool,
  itemTl: number | undefined,
  cost: number
): number | null {
  for (let tl = Math.max(1, itemTl ?? 1); tl <= 6; tl++) {
    if (scrapPoolBucket(pool, tl) >= cost) return tl
  }
  return null
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
 * Patch for the unified mech conditions editor (plan 2.3 / gap 21): the
 * editor edits the `unifiedMechConditions()` list, and this maps the edited
 * list back onto the two storage forms — removing a flag-backed label
 * ('Shutdown' / 'Vulnerable' / 'Destroyed') clears the automation-written
 * boolean flag (the manual clear, gap 8); every other label lands in
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
