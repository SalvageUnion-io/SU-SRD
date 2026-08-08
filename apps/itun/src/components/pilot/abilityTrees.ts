/**
 * Ability-tree scoping shared by the pilot creation flow and the live sheet's
 * Add Abilities searcher: the set of trees a pilot may draw abilities from.
 *
 * The logic itself lives in `salvageunion-reference/rules` — this is the app's
 * seam onto it. It used to be implemented here AND, byte for byte, again in
 * `component-lib`'s ClassAbilityStep; both copies shared the same bug, which is
 * the argument for there being one.
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
 * Edit mode (`allLevels`) adds the advanced and legendary trees, a HYBRID's two
 * borrowed trees, and the trees of already-selected abilities — so a pilot who
 * advanced into a Hybrid keeps their learned (now sealed) core trees visible
 * and toggleable.
 */
export function treesFor(cls: ClassLike, allLevels: boolean, selectedTrees: string[]): string[] {
  return offeredAbilityTrees(cls, { allLevels, selectedTrees })
}
