import type { SURefAbility, SURefClass } from 'salvageunion-reference'
import {
  LEGENDARY_ABILITY_COST,
  ADVANCED_ABILITY_COST,
  CORE_ABILITY_COST,
  DEFAULT_ABILITY_COST,
} from '../../../constants/gameRules'

/**
 * Calculate the TP cost for selecting an ability based on the character's class(es)
 */
export function getAbilityCost(
  ability: SURefAbility,
  selectedClass: SURefClass | undefined,
  selectedAdvancedClass?: SURefClass | undefined
): number {
  if (!selectedClass) return 0

  // Check if ability is from core class's legendary tree
  const isCoreLegendary =
    selectedClass &&
    'legendaryTree' in selectedClass &&
    selectedClass.legendaryTree === ability.tree
  if (isCoreLegendary) return LEGENDARY_ABILITY_COST

  // Check if ability is from hybrid class's legendary tree
  const isHybridLegendary =
    selectedAdvancedClass &&
    'legendaryTree' in selectedAdvancedClass &&
    selectedAdvancedClass.legendaryTree === ability.tree
  if (isHybridLegendary) return LEGENDARY_ABILITY_COST

  // Check if ability is from core class's advanced tree
  const isCoreAdvanced =
    selectedClass && 'advancedTree' in selectedClass && selectedClass.advancedTree === ability.tree
  if (isCoreAdvanced) return ADVANCED_ABILITY_COST

  // Check if ability is from hybrid class's advanced tree
  const isHybridAdvanced =
    selectedAdvancedClass &&
    'advancedTree' in selectedAdvancedClass &&
    selectedAdvancedClass.advancedTree === ability.tree
  if (isHybridAdvanced) return ADVANCED_ABILITY_COST

  // Check if ability is from core class's core trees
  const isCore =
    selectedClass &&
    'coreTrees' in selectedClass &&
    Array.isArray(selectedClass.coreTrees) &&
    selectedClass.coreTrees.includes(ability.tree)
  if (isCore) return CORE_ABILITY_COST

  return DEFAULT_ABILITY_COST
}
