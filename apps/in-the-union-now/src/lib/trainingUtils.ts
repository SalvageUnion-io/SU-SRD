import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import type { EntityRefRow } from '../types/common'

export type TrainingReceipt = {
  tp_granted: number
  abilities_learned: Array<{
    ref_id: string
    name: string
    tp_cost: number
  }>
  tp_remaining: number
}

export type AbilityTier = 'core' | 'advanced' | 'hybrid' | 'legendary'

/** TP cost per ability level */
export function getAbilityCost(level: number | string): number {
  if (level === 1) return 1
  if (level === 2) return 2 // advanced/hybrid
  if (level === 3 || level === 'L') return 3 // legendary
  return 1
}

/** Determine which ability tiers are available based on Pilot Bay TL */
export function getAvailableTiers(pilotBayTL: number): Set<number | string> {
  const tiers = new Set<number | string>([1]) // Core always available
  if (pilotBayTL >= 3) tiers.add(2) // Advanced/hybrid at TL3+
  if (pilotBayTL >= 5) {
    tiers.add(3) // Legendary at TL5+
    tiers.add('L')
  }
  return tiers
}

/**
 * Get ability trees available to a pilot based on their class.
 * Returns core trees from the base class plus advanced/legendary trees if applicable.
 */
export function getClassTrees(classRef: string): {
  coreTrees: string[]
  advancedTree?: string
  legendaryTree?: string
} {
  const cls = SalvageUnionReference.get('classes', classRef)
  if (!cls) return { coreTrees: [] }

  const coreTrees = 'coreTrees' in cls ? (cls.coreTrees as string[]) : []
  const advancedTree = 'advancedTree' in cls ? (cls.advancedTree as string) : undefined
  const legendaryTree = 'legendaryTree' in cls ? (cls.legendaryTree as string) : undefined

  return { coreTrees, advancedTree, legendaryTree }
}

/**
 * Count abilities by tier for prerequisite checking.
 * Core = level 1, Advanced/Hybrid = level 2, Legendary = level 3 or 'L'
 */
export function countAbilitiesByTier(abilityRefs: EntityRefRow[]): {
  core: number
  advanced: number
  legendary: number
} {
  let core = 0
  let advanced = 0
  let legendary = 0

  for (const ref of abilityRefs) {
    if (ref.schema_name !== 'abilities') continue
    const ability = SalvageUnionReference.get('abilities', ref.schema_ref_id)
    if (!ability) continue
    const level = 'level' in ability ? ability.level : undefined
    if (level === 1) core++
    else if (level === 2) advanced++
    else if (level === 3 || level === 'L') legendary++
  }

  return { core, advanced, legendary }
}

/**
 * Check if a pilot meets prerequisites for a given ability level.
 * - Advanced/Hybrid (level 2): need 6 core abilities
 * - Legendary (level 3/'L'): need 6 core + 3 advanced/hybrid
 */
export function meetsPrerequisites(
  level: number | string,
  counts: { core: number; advanced: number; legendary: number }
): boolean {
  if (level === 1) return true
  if (level === 2) return counts.core >= 6
  if (level === 3 || level === 'L') return counts.core >= 6 && counts.advanced >= 3
  return true
}

/**
 * Get all abilities available for training, filtered by class trees and TL gates.
 * Excludes abilities the pilot already has.
 */
export function getTrainableAbilities(
  classRef: string,
  crawlerTL: number,
  existingAbilityIds: Set<string>
): SURefEntity[] {
  const { coreTrees, advancedTree, legendaryTree } = getClassTrees(classRef)
  const availableTiers = getAvailableTiers(crawlerTL)

  const allTrees = new Set<string>([...coreTrees])
  if (advancedTree) allTrees.add(advancedTree)
  if (legendaryTree) allTrees.add(legendaryTree)

  const abilities = SalvageUnionReference.findAllIn('abilities', (ability) => {
    const tree = 'tree' in ability ? (ability.tree as string) : undefined
    const level = 'level' in ability ? ability.level : undefined
    if (!tree || !allTrees.has(tree)) return false
    if (level !== undefined && !availableTiers.has(level as number | string)) return false
    if (existingAbilityIds.has(ability.id)) return false
    return true
  }) as SURefEntity[]

  return abilities
}

/** Check if TP has already been granted this downtime */
export function hasReceivedTP(receipt: TrainingReceipt | undefined): boolean {
  return !!receipt && receipt.tp_granted > 0
}
