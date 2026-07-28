/**
 * Traits a mech has because of what is installed on it (ADR-029).
 *
 * Nothing aggregated a mech's traits before this. Bio-Wings says "Your Mech
 * gains the Fly Trait" — a trait that belongs to the MECH, not to the system
 * that granted it — so there was no shape to encode it into: declaring it as a
 * self-effect would have said the Bio-Wings system flies, which is wrong rather
 * than merely incomplete.
 *
 * That is why the blocker was never "a place to declare effects". It was that
 * `ChoiceEffectSchema` had no `target`, and this derivation did not exist.
 *
 * Pure and side-effect-free (ADR-006). Derived at read time, never stored: a
 * trait disappears the moment the granting item is removed, with no bookkeeping.
 */

import { resolveInstalledRef } from './resolveRefs.js'

/** A trait a mech holds, and what granted it. */
export type MechTrait = {
  /** Trait name, e.g. 'Fly'. */
  name: string
  /** Optional magnitude, e.g. Burn 1. */
  amount?: string | number
  /** Display name of the installed item that granted it. */
  source: string
  /** The installed ref, so provenance UI can link back. */
  ref: string
}

type EffectLike = {
  op: string
  value?: string
  amount?: string | number
  target?: string
}

type InstalledLike = { name?: string; appliedEffects?: EffectLike[] }

/**
 * Every trait the mech's installed systems and modules grant it.
 *
 * Only `target: 'hostMech'` effects are collected — a `self` effect belongs to
 * the item's own card, not to the mech. Duplicates keep the highest magnitude,
 * matching `resolveChoiceView`'s upgrade rule (Explosive 1 → 2) so the two
 * resolvers cannot disagree about what stacking means.
 */
export function mechTraits(mech: { systems?: string[]; modules?: string[] }): MechTrait[] {
  const installed = [...(mech.systems ?? []), ...(mech.modules ?? [])]
  const byName = new Map<string, MechTrait>()

  for (const ref of installed) {
    let item: InstalledLike | undefined
    try {
      item = (resolveInstalledRef(ref) ?? undefined) as InstalledLike | undefined
    } catch {
      // An unresolvable ref grants nothing, exactly as it contributes nothing.
      item = undefined
    }
    for (const effect of item?.appliedEffects ?? []) {
      if (effect.target !== 'hostMech') continue
      if (!effect.value) continue
      if (effect.op === 'removeTrait') {
        byName.delete(effect.value)
        continue
      }
      if (effect.op !== 'addTrait') continue
      const existing = byName.get(effect.value)
      const next: MechTrait = {
        name: effect.value,
        ...(effect.amount !== undefined ? { amount: effect.amount } : {}),
        source: item?.name ?? ref,
        ref,
      }
      if (!existing) {
        byName.set(effect.value, next)
        continue
      }
      const a = Number(existing.amount ?? 0)
      const b = Number(next.amount ?? 0)
      if (b > a) byName.set(effect.value, next)
    }
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}
