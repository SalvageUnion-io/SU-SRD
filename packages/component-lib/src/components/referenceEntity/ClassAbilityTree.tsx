import { useMemo } from 'react'
import type { SURefAbility, SURefClass } from 'salvageunion-reference'
import { SalvageUnionReference, isCoreClass, isBaseAdvancedClass } from 'salvageunion-reference'
import { ReferenceEntityCard } from './card/ReferenceEntityCard'
import { SectionSeparator } from './SectionSeparator'
import { useDetailModal } from './useDetailModal'

type TreeGroup = { tree: string; abilities: SURefAbility[] }

type ResolvedTrees = {
  coreTrees: TreeGroup[]
  advancedTree: TreeGroup | null
  legendaryTree: TreeGroup | null
}

type ClassAbilityTreeProps = {
  classEntity: SURefClass
  activeAbilityIds?: Set<string>
}

function levelOrder(l: number | 'L' | 'G'): number {
  return typeof l === 'number' ? l : l === 'L' ? 90 : 99
}

function resolveClassTrees(classEntity: SURefClass): ResolvedTrees {
  const allAbilities = SalvageUnionReference.Abilities.all()

  const resolveTree = (treeName: string): TreeGroup | null => {
    const matching = allAbilities
      .filter((a) => a.tree === treeName)
      .sort((a, b) => levelOrder(a.level) - levelOrder(b.level))
    return matching.length > 0 ? { tree: treeName, abilities: matching } : null
  }

  if (isCoreClass(classEntity)) {
    return {
      coreTrees: classEntity.coreTrees.map(resolveTree).filter(Boolean) as TreeGroup[],
      advancedTree: classEntity.advancedTree ? resolveTree(classEntity.advancedTree) : null,
      legendaryTree: classEntity.legendaryTree ? resolveTree(classEntity.legendaryTree) : null,
    }
  }

  if (isBaseAdvancedClass(classEntity)) {
    return {
      coreTrees: [],
      advancedTree: resolveTree(classEntity.advancedTree),
      legendaryTree: resolveTree(classEntity.legendaryTree),
    }
  }

  return { coreTrees: [], advancedTree: null, legendaryTree: null }
}

function AbilityTreeListing({ ability, disabled }: { ability: SURefAbility; disabled: boolean }) {
  const detailModal = useDetailModal(ability)

  return (
    <>
      <ReferenceEntityCard
        data={ability}
        size="medium"
        extent="head"
        controls={[detailModal.control]}
        disabled={disabled}
      />
      {detailModal.modal}
    </>
  )
}

function TreeSection({
  tree,
  abilities,
  activeAbilityIds,
}: TreeGroup & { activeAbilityIds?: Set<string> }) {
  return (
    <div className="space-y-4">
      <div className="pt-2">
        <SectionSeparator label={tree} value="Tree" compact />
      </div>
      {abilities.map((ability) => (
        <AbilityTreeListing
          key={ability.id}
          ability={ability}
          disabled={activeAbilityIds !== undefined && !activeAbilityIds.has(ability.id)}
        />
      ))}
    </div>
  )
}

export function ClassAbilityTree({ classEntity, activeAbilityIds }: ClassAbilityTreeProps) {
  const trees = useMemo(() => resolveClassTrees(classEntity), [classEntity])

  const hasCoreTrees = trees.coreTrees.length > 0
  const hasSpecialTrees = !!trees.advancedTree || !!trees.legendaryTree
  if (!hasCoreTrees && !hasSpecialTrees) return null

  return (
    <div className="space-y-1.5">
      {hasCoreTrees && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {trees.coreTrees.map((group) => (
            <TreeSection key={group.tree} {...group} activeAbilityIds={activeAbilityIds} />
          ))}
        </div>
      )}
      {hasSpecialTrees && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {trees.advancedTree && (
            <TreeSection {...trees.advancedTree} activeAbilityIds={activeAbilityIds} />
          )}
          {trees.legendaryTree && (
            <TreeSection {...trees.legendaryTree} activeAbilityIds={activeAbilityIds} />
          )}
        </div>
      )}
    </div>
  )
}
