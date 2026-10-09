/**
 * The impure edge of `advancement.ts`.
 *
 * `advancement.ts` is pure over neutral inputs (ADR-006) and deliberately does
 * not import `SalvageUnionReference`. Consumers still need the live dataset,
 * and every one of them building it by hand is how two copies of the same
 * tree-offering function ended up in two packages. This module is the single
 * seam where the catalog is read, so the rules stay pure and the callers stay
 * thin.
 *
 * Preload requirement: `classes` and `ability-tree-requirements`.
 */

import { SalvageUnionReference } from '../index.js'
import type { SURefClass } from '../schemas/index.js'
import type { AdvancementClassInput, AdvancementDataset } from './advancement.js'
import { hybridGrantedTrees } from './advancement.js'

/** Narrow a reference class record to the primitives advancement reads. */
export function toAdvancementClass(cls: SURefClass): AdvancementClassInput {
  return {
    name: cls.name,
    coreTrees: 'coreTrees' in cls ? cls.coreTrees : undefined,
    advancedTree: 'advancedTree' in cls ? cls.advancedTree : undefined,
    legendaryTree: 'legendaryTree' in cls ? cls.legendaryTree : undefined,
    hybrid: 'hybrid' in cls ? cls.hybrid : undefined,
    advanceable: 'advanceable' in cls ? cls.advanceable : undefined,
  }
}

/**
 * Build the advancement dataset from the loaded catalog.
 *
 * Not memoised: it is two maps over 11 class records and 20 requirement rows,
 * and a cache would have to be invalidated on preload — a staleness bug in
 * exchange for nothing measurable.
 */
export function liveAdvancementDataset(): AdvancementDataset {
  return {
    classes: (SalvageUnionReference.Classes.all() as SURefClass[]).map(toAdvancementClass),
    requirements: SalvageUnionReference.AbilityTreeRequirements.all().map((r) => ({
      name: r.name,
      requirement: r.requirement,
    })),
  }
}

/**
 * The ability trees a class may draw from, for a picker.
 *
 * It cannot begin from `coreTrees`: **hybrid classes do not have them**, and a
 * hybrid would be offered only its own tree and its Legendary tree — two of its
 * four. A hybrid's other two trees come from `ability-tree-requirements`.
 *
 * `selectedTrees` are appended so trees the pilot already holds abilities in
 * stay visible and toggleable — including SEALED ones, which are retained
 * permanently and must never disappear from a sheet just because they are
 * closed to new picks.
 *
 * `allLevels: false` is the creation pool and is unchanged: core trees only,
 * which correctly yields nothing for a hybrid (they are not legal creation
 * classes).
 */
export function offeredAbilityTrees(
  cls: AdvancementClassInput,
  options: { allLevels: boolean; selectedTrees?: readonly string[] }
): string[] {
  const { allLevels, selectedTrees = [] } = options
  const trees: string[] = [...(cls.coreTrees ?? [])]

  if (allLevels) {
    if (cls.hybrid === true) {
      for (const tree of hybridGrantedTrees(liveAdvancementDataset(), cls.name)) {
        if (!trees.includes(tree)) trees.push(tree)
      }
    }
    if (cls.advancedTree !== undefined && !trees.includes(cls.advancedTree)) {
      trees.push(cls.advancedTree)
    }
    if (cls.legendaryTree !== undefined && !trees.includes(cls.legendaryTree)) {
      trees.push(cls.legendaryTree)
    }
    for (const tree of selectedTrees) {
      if (!trees.includes(tree)) trees.push(tree)
    }
  }

  return trees
}
