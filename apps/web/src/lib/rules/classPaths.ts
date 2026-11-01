/**
 * What a class page lays out, resolved from the dataset (Workshop Manual
 * p.23 and each class spread): a Core class's trees and the paths it can
 * advance into — its own Advanced tree first, then its Hybrid Classes — or a Hybrid
 * Class's own tree and the Core trees it branches into.
 *
 * A Hybrid Class opens from a Core tree its requirement names (Fabricator:
 * Forging or Electronics), so a Core class reaches every hybrid whose
 * requirement names one of its own trees. The Salvager advances into nothing
 * (`advanceable: false`), though its trees span every class.
 */
import type { RefAbility, RefClass } from 'salvageunion-reference'
import { isBaseAdvancedClass, isCoreClass, SalvageUnionReference } from 'salvageunion-reference'
import { advancementOptionsFor, liveAdvancementDataset } from 'salvageunion-reference/rules'
import { classDrawingTree } from './classPath'

export type AbilityTreeGroup = { tree: string; abilities: RefAbility[] }

/** One way a Core class advances, or a Hybrid Class's own trees. */
export type ClassPath = {
  /** The Hybrid Class; absent for the Core class's own Advanced tree. */
  hybrid?: RefClass
  advanced: AbilityTreeGroup
  legendary: AbilityTreeGroup | null
  /** The Core trees the book requires, any one of them (`ability-tree-requirements`). */
  requirement: string[]
  /** For a hybrid on a Core class's page: which of the class's own trees opens it. */
  via?: string
}

/** A Core tree a Hybrid Class branches into, and the Core class that owns it. */
export type BranchTree = {
  tree: string
  group: AbilityTreeGroup | null
  owner: RefClass | undefined
}

export type ClassPlan =
  | { kind: 'core'; classEntity: RefClass; coreTrees: AbilityTreeGroup[]; paths: ClassPath[] }
  | { kind: 'hybrid'; classEntity: RefClass; path: ClassPath; branches: BranchTree[] }
  | { kind: 'none' }

function levelOrder(level: number | 'L' | 'G'): number {
  return typeof level === 'number' ? level : level === 'L' ? 90 : 99
}

function resolveTree(tree: string): AbilityTreeGroup | null {
  const abilities = SalvageUnionReference.Abilities.all()
    .filter((ability) => ability.tree === tree)
    .sort((a, b) => levelOrder(a.level) - levelOrder(b.level))
  return abilities.length > 0 ? { tree, abilities } : null
}

/** Each Advanced / Hybrid / Legendary tree's requirement, by tree name. */
function requirementsByTree(): Map<string, string[]> {
  return new Map(
    SalvageUnionReference.AbilityTreeRequirements.all().map((r) => [r.name, r.requirement])
  )
}

function pathFor(
  requirements: Map<string, string[]>,
  advancedTree: string,
  legendaryTree: string | undefined
): ClassPath | null {
  const advanced = resolveTree(advancedTree)
  if (!advanced) return null
  return {
    advanced,
    legendary: legendaryTree ? resolveTree(legendaryTree) : null,
    requirement: requirements.get(advancedTree) ?? [],
  }
}

export function resolveClassPlan(classEntity: RefClass): ClassPlan {
  const requirements = requirementsByTree()
  if (isCoreClass(classEntity)) {
    const ownTrees: readonly string[] = classEntity.coreTrees
    const coreTrees = ownTrees
      .map((tree) => resolveTree(tree))
      .filter((group): group is AbilityTreeGroup => group !== null)
    const paths: ClassPath[] = []
    if (classEntity.advanceable) {
      const own = classEntity.advancedTree
        ? pathFor(requirements, classEntity.advancedTree, classEntity.legendaryTree)
        : null
      if (own) paths.push(own)
      // The ring (advancement.ts): each Hybrid on this class's edges, and the
      // class's own tree that opens it.
      const hybrids = SalvageUnionReference.Classes.all().filter(isBaseAdvancedClass)
      for (const option of advancementOptionsFor(liveAdvancementDataset(), classEntity.name)) {
        const hybrid = hybrids.find((c) => c.name === option.name)
        if (option.kind !== 'hybrid' || !hybrid?.advancedTree) continue
        const path = pathFor(requirements, hybrid.advancedTree, hybrid.legendaryTree)
        if (path) paths.push({ ...path, hybrid, via: option.gateTree })
      }
    }
    return { kind: 'core', classEntity, coreTrees, paths }
  }

  if (isBaseAdvancedClass(classEntity)) {
    const path = classEntity.advancedTree
      ? pathFor(requirements, classEntity.advancedTree, classEntity.legendaryTree)
      : null
    if (!path) return { kind: 'none' }
    const branches = path.requirement.map((tree) => ({
      tree,
      group: resolveTree(tree),
      owner: classDrawingTree(tree),
    }))
    return { kind: 'hybrid', classEntity, path: { ...path, hybrid: classEntity }, branches }
  }

  return { kind: 'none' }
}
