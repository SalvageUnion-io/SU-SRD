/**
 * Ability-tree scoping shared by the pilot creation flow and the live sheet's
 * Add Abilities searcher: the set of trees a pilot may draw abilities from.
 *
 * The logic itself lives in `salvageunion-reference/rules` — this is the app's
 * seam onto it, so there is one implementation, not one per consumer.
 */

import { offeredAbilityTrees } from 'salvageunion-reference/rules'

export type ClassLike = {
  name: string
  coreTrees?: string[]
  advancedTree?: string
  legendaryTree?: string
  hybrid?: boolean
}

/**
 * Trees offered for the given class.
 *
 * `allLevels` adds the advanced and legendary trees, a HYBRID's two
 * borrowed trees, and the trees of already-selected abilities — so a pilot who
 * advanced into a Hybrid keeps their learned (now sealed) core trees visible
 * and toggleable.
 */
export function treesFor(cls: ClassLike, allLevels: boolean, selectedTrees: string[]): string[] {
  return offeredAbilityTrees(cls, { allLevels, selectedTrees })
}
