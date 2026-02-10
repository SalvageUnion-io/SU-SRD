import type { HydratedEntity } from '../../../types/hydrated'
import type { SURefAbility } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'

/**
 * Check if a pilot has fulfilled requirements for a tree
 * @param abilities - Array of pilot's abilities
 * @param treeName - Name of the tree to check requirements for
 * @returns Boolean indicating if at least one requirement is met (3+ abilities in required tree)
 */
export function checkTreeRequirements(abilities: HydratedEntity[], treeName: string): boolean {
  // Count abilities by tree
  const abilitiesByTree: Record<string, number> = {}
  abilities.forEach((entity) => {
    const ability = entity.ref as SURefAbility
    const tree = ability.tree
    abilitiesByTree[tree] = (abilitiesByTree[tree] || 0) + 1
  })

  // Get completed trees (3+ abilities in each)
  const completedTrees = new Set(
    Object.entries(abilitiesByTree)
      .filter(([, count]) => count >= 3)
      .map(([tree]) => tree)
  )

  // Find the tree requirement
  const allTreeRequirements = SalvageUnionReference.AbilityTreeRequirements.all()
  const treeRequirement = allTreeRequirements.find((req) => req.name === treeName)

  if (!treeRequirement) {
    return false
  }

  // ANY of the required trees must be completed (not all)
  return treeRequirement.requirement.some((requiredTree) => completedTrees.has(requiredTree))
}
