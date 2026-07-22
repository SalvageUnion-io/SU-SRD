/**
 * Pilot snapshot enrichment for soft-warning evaluation.
 *
 * The `Pilot` type (from the Zod schema) stores `abilities` as `string[]`
 * (slug refs) and the class as `classRef`. The soft-warning system's
 * `PilotSnapshot` expects `AbilityInput[]` — structs carrying the ability's
 * tree, level and tier — plus class tier flags.
 *
 * `enrichPilotSnapshot` resolves all of that from `salvageunion-reference`,
 * so the prerequisite checks in softWarnings.ts (tree order, 6-core gates,
 * one-Legendary, Salvager cap) receive the data they need. Wizards call this
 * pre-save on both the stored pilot (before) and the form state (after).
 *
 * All functions are pure — no side effects, no async, no React.
 * Prerequisite: SalvageUnionReference must be preloaded with 'abilities' and
 * 'classes' before calling (the app root preloads 'all').
 */

import { SalvageUnionReference } from '../index.js'
import type { AbilityInput, AbilityTier, PilotSnapshot } from './types.js'

type TreeTierIndex = {
  core: Set<string>
  advanced: Set<string>
  legendary: Set<string>
}

/**
 * Classify every known ability tree by tier from the Classes dataset:
 * core = any class's coreTrees entry; advanced = any advancedTree (base
 * advanced AND hybrid specialisations); legendary = any legendaryTree.
 */
function buildTreeTierIndex(): TreeTierIndex {
  const index: TreeTierIndex = {
    core: new Set(),
    advanced: new Set(),
    legendary: new Set(),
  }
  for (const cls of SalvageUnionReference.Classes.all()) {
    if ('coreTrees' in cls && Array.isArray(cls.coreTrees)) {
      for (const tree of cls.coreTrees) index.core.add(tree)
    }
    if ('advancedTree' in cls && typeof cls.advancedTree === 'string' && cls.advancedTree) {
      index.advanced.add(cls.advancedTree)
    }
    if ('legendaryTree' in cls && typeof cls.legendaryTree === 'string' && cls.legendaryTree) {
      index.legendary.add(cls.legendaryTree)
    }
  }
  return index
}

function tierForTree(tree: string | undefined, index: TreeTierIndex): AbilityTier | undefined {
  if (tree === undefined) return undefined
  if (index.legendary.has(tree)) return 'legendary'
  if (index.advanced.has(tree)) return 'advanced'
  if (index.core.has(tree)) return 'core'
  return undefined
}

/** Resolve a class by stored ref (id, name, or slug — same logic as classRef.ts). */
function resolveClass(ref: string | undefined) {
  if (!ref) return undefined
  return SalvageUnionReference.Classes.find(
    (c) => c.id === ref || c.name === ref || c.name.toLowerCase() === ref.toLowerCase()
  )
}

/**
 * Enrich a `Pilot`-shaped object (or wizard form state) into a `PilotSnapshot`
 * suitable for `evaluateSoftWarnings`. Resolves each ability's tree/level and
 * classifies its tier; resolves the class to set `isSalvager`/`classTier`.
 *
 * Unknown ability refs survive as bare `{ ref }` entries — the warning checks
 * skip them rather than fabricating violations.
 */
export function enrichPilotSnapshot(pilot: {
  abilities: string[]
  classRef?: string
}): PilotSnapshot {
  const treeIndex = buildTreeTierIndex()

  const abilities: AbilityInput[] = pilot.abilities.map((ref) => {
    const ability = SalvageUnionReference.Abilities.find((a) => a.id === ref || a.name === ref)
    if (!ability) return { ref }
    const level = ability.level
    const tier = level === 'L' ? 'legendary' : tierForTree(ability.tree, treeIndex)
    return {
      ref,
      name: ability.name,
      tree: ability.tree,
      level,
      tier,
    }
  })

  const cls = resolveClass(pilot.classRef)
  const hasCoreTrees =
    cls !== undefined &&
    'coreTrees' in cls &&
    Array.isArray(cls.coreTrees) &&
    cls.coreTrees.length > 0
  const isSpecialisation = cls !== undefined && !hasCoreTrees && 'advancedTree' in cls

  return {
    abilities,
    isSalvager: cls?.name === 'Salvager' || undefined,
    classTier: hasCoreTrees ? 'base' : isSpecialisation ? 'advanced-hybrid' : undefined,
    className: cls?.name,
  }
}
