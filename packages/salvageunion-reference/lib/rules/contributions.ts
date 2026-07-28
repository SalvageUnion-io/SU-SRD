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
import { matchesRef } from './resolveRefs.js'

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

export type ContributionAmount = number | { flat?: number; perTechLevel: number }

/** A contribution as declared on a piece of reference content. */
export type DeclaredContribution = {
  stat: ContributionStat
  amount: ContributionAmount
  target?: ContributionTarget
  stacks?: boolean
  voidWhen?: 'damaged' | 'destroyed'
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
export function resolveAmount(amount: ContributionAmount, techLevel?: number): number {
  if (typeof amount === 'number') return amount
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
export function abilityContributions(
  abilityRefs: readonly string[] | undefined,
  target: ContributionTarget,
  stat: ContributionStat,
  techLevel?: number
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
      const amount = resolveAmount(c.amount, techLevel)
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
