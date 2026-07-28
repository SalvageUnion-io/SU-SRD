/**
 * Resolving declared contributions into numbers (ADR-029).
 *
 * The numeric half of the converged modifier model. Content declares WHAT it
 * changes (`ContributionSchema`); this module works out how much that is worth
 * for a given holder, and — crucially — keeps each contribution's SOURCE
 * attached, so a derivation can hand the provenance panel "Beefcake +7" instead
 * of an anonymous addend.
 *
 * Pure and side-effect-free ([ADR-006](../../docs/adrs/ADR-006-pure-rules-logic.md)):
 * no I/O, no ORM writes, no mutation of inputs.
 */

import { SalvageUnionReference } from '../index.js'
import { matchesRef, resolveInstalledRef } from './resolveRefs.js'

/** The stat keys a contribution may target. Mirrors `ContributionStatSchema`. */
export type ContributionStat =
  | 'structurePoints'
  | 'energyPoints'
  | 'heatCapacity'
  | 'cargoCapacity'
  | 'systemSlots'
  | 'moduleSlots'
  | 'maxHp'
  | 'maxAp'
  | 'inventorySlots'

export type ContributionTarget = 'self' | 'pilot' | 'pilotedMech' | 'crawler'

export type ContributionAmount =
  | number
  | { flat?: number; perTechLevel: number }
  | { fromStat: ContributionStat }

/** A contribution as declared on a piece of reference content. */
export type DeclaredContribution = {
  stat: ContributionStat
  amount: ContributionAmount
  target?: ContributionTarget
  stacks?: boolean
  voidWhen?: 'damaged' | 'destroyed'
  /** `activated` applies only while switched on in Guided Play (ADR-019). */
  duration?: 'permanent' | 'activated'
  note?: string
}

/** A resolved contribution: an amount, and the content that produced it. */
export type ResolvedContribution = {
  /** Display name of the granting entity, e.g. 'Beefcake'. */
  source: string
  /** Slug/name ref so provenance UI can link back to it. */
  ref: string
  stat: ContributionStat
  /** Signed, already multiplied by copies and resolved against tech level. */
  amount: number
  /** How many copies contributed (1 unless the item stacks and is installed twice). */
  copies: number
}

/**
 * Resolve a declared amount.
 *
 * `perTechLevel` needs the target's tech level; a caller that cannot supply one
 * resolves it to the flat part rather than guessing, so an unknown tech level
 * under-counts visibly instead of inventing a number.
 */
export function resolveAmount(
  amount: ContributionAmount,
  techLevel?: number,
  stats?: Partial<Record<ContributionStat, number>>
): number {
  if (typeof amount === 'number') return amount
  if ('fromStat' in amount) {
    // The amount IS another of the target's stats (Hull Magnetiser: Cargo by
    // System Slot Value). An unknown stat resolves to 0 rather than a guess.
    return stats?.[amount.fromStat] ?? 0
  }
  const flat = amount.flat ?? 0
  if (techLevel === undefined) return flat
  return flat + amount.perTechLevel * techLevel
}

/** Content that may declare contributions. */
type ContributionHost = { name?: string; contributions?: DeclaredContribution[] }

/**
 * Every contribution the named abilities declare for `target`/`stat`.
 *
 * Abilities do not stack per copy — holding an ability twice is not a thing —
 * so each resolved contribution is one copy.
 */
/**
 * Which `duration: 'activated'` contributions are currently switched on.
 *
 * Manual expiry by design: a player toggles an activated effect on and off.
 * Salvage Union states real durations ("this effect lasts for 1 hour"), but the
 * app has no play clock and inventing one would put time into the data layer —
 * so the table keeps time and the app keeps state, which is the same division
 * ADR-001's honour system already relies on.
 *
 * Ephemeral (ADR-019): this lives in play state and is never persisted.
 */
export type ActiveEffects = Readonly<Record<string, boolean>>

/** True when a contribution applies right now. */
function isLive(c: DeclaredContribution, ref: string, active: ActiveEffects | undefined): boolean {
  if ((c.duration ?? 'permanent') === 'permanent') return true
  return active?.[ref] === true
}

export function abilityContributions(
  abilityRefs: readonly string[] | undefined,
  target: ContributionTarget,
  stat: ContributionStat,
  techLevel?: number,
  active?: ActiveEffects,
  stats?: Partial<Record<ContributionStat, number>>
): ResolvedContribution[] {
  if (!abilityRefs?.length) return []
  const out: ResolvedContribution[] = []
  for (const ref of abilityRefs) {
    let ability: ContributionHost | undefined
    try {
      ability = SalvageUnionReference.Abilities.find((a) => matchesRef(a, ref)) as
        | ContributionHost
        | undefined
    } catch {
      // A missing catalog is a data problem, not a crash: an unresolvable ref
      // contributes 0, exactly as an unresolvable installed item does.
      ability = undefined
    }
    for (const c of ability?.contributions ?? []) {
      if (c.stat !== stat) continue
      if ((c.target ?? 'self') !== target) continue
      if (!isLive(c, ref, active)) continue
      const amount = resolveAmount(c.amount, techLevel, stats)
      if (amount === 0) continue
      out.push({
        source: ability?.name ?? ref,
        ref,
        stat,
        amount,
        copies: 1,
      })
    }
  }
  return out
}

/** Sum of resolved contributions — the number a derivation folds in. */
export function sumContributions(contributions: readonly ResolvedContribution[]): number {
  return contributions.reduce((total, c) => total + c.amount, 0)
}

/**
 * Contributions declared by the mech's own installed systems and modules.
 *
 * Distinct from `statBonus`, which is a flat per-copy number with no target,
 * duration or expression. An installed item's contribution targets `self` — the
 * host mech — so `target` is not consulted here.
 *
 * `stats` supplies the host's own values for `fromStat` amounts: Hull
 * Magnetiser raises Cargo "by its System Slot Value", a number that changes
 * with the chassis and so cannot be written as a constant.
 */
export function installedContributions(
  installedRefs: readonly string[] | undefined,
  stat: ContributionStat,
  options?: {
    techLevel?: number
    active?: ActiveEffects
    stats?: Partial<Record<ContributionStat, number>>
  }
): ResolvedContribution[] {
  if (!installedRefs?.length) return []
  const counted = new Map<string, number>()
  for (const ref of installedRefs) counted.set(ref, (counted.get(ref) ?? 0) + 1)

  const out: ResolvedContribution[] = []
  for (const [ref, copies] of counted) {
    let item: ContributionHost | undefined
    try {
      item = (resolveInstalledRef(ref) ?? undefined) as ContributionHost | undefined
    } catch {
      item = undefined
    }
    for (const c of item?.contributions ?? []) {
      if (c.stat !== stat) continue
      if ((c.target ?? 'self') !== 'self') continue
      if (!isLive(c, ref, options?.active)) continue
      const each = resolveAmount(c.amount, options?.techLevel, options?.stats)
      // `stacks` defaults TRUE for an installed item — two Heat Sinks are two
      // Heat Sinks — matching statBonus's per-copy semantics.
      const amount = c.stacks === false ? each : each * copies
      if (amount === 0) continue
      out.push({
        source: item?.name ?? ref,
        ref,
        stat,
        amount,
        copies: c.stacks === false ? 1 : copies,
      })
    }
  }
  return out
}
