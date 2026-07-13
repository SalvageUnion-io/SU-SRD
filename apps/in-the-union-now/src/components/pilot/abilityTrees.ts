/**
 * Ability-tree scoping shared by the pilot creation flow and the live sheet's
 * Add Abilities searcher: the set of trees a pilot may draw abilities from.
 */

export type ClassLike = {
  coreTrees?: string[]
  advancedTree?: string
  legendaryTree?: string
}

/**
 * Trees offered for the given class. Edit mode (`allLevels`) appends the
 * advanced and legendary trees, plus the trees of already-selected abilities —
 * so a pilot who switched to a Hybrid specialisation keeps their learned core
 * trees visible and toggleable.
 */
export function treesFor(cls: ClassLike, allLevels: boolean, selectedTrees: string[]): string[] {
  const trees: string[] = [...(cls.coreTrees ?? [])]
  if (allLevels) {
    if (cls.advancedTree) trees.push(cls.advancedTree)
    if (cls.legendaryTree) trees.push(cls.legendaryTree)
    for (const tree of selectedTrees) {
      if (!trees.includes(tree)) trees.push(tree)
    }
  }
  return trees
}
