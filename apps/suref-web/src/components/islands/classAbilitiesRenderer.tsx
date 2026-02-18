import { useMemo } from 'react'
import type { SURefAbility, SURefClass } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntityDisplay, SectionSeparator, useDetailModal } from 'suref-react'

type TreeGroup = { tree: string; abilities: SURefAbility[] }

type ClassAbilitiesContentProps = {
  compact: boolean
  selectedClass: SURefClass | undefined
  selectedAdvancedClass: SURefClass | undefined
}

function AbilityListing({ ability }: { ability: SURefAbility }) {
  const detailModal = useDetailModal(ability)

  return (
    <>
      <EntityDisplay data={ability} compact listing controls={[detailModal.control]} />
      {detailModal.modal}
    </>
  )
}

function TreeSection({ tree, abilities }: TreeGroup) {
  return (
    <div className="space-y-1.5">
      <div className="pt-2">
        <SectionSeparator label={`${tree} Tree`} />
      </div>
      {abilities.map((ability) => (
        <AbilityListing key={ability.id} ability={ability} />
      ))}
    </div>
  )
}

export function ClassAbilitiesContent({
  selectedClass,
  selectedAdvancedClass,
}: ClassAbilitiesContentProps) {
  const cls = selectedClass || selectedAdvancedClass

  const coreTreeNames = useMemo(() => {
    if (!cls) return []
    if ('coreTrees' in cls && Array.isArray(cls.coreTrees)) {
      return cls.coreTrees as string[]
    }
    return []
  }, [cls])

  const advancedTreeName = useMemo(() => {
    if (!cls) return undefined
    return 'advancedTree' in cls && cls.advancedTree ? (cls.advancedTree as string) : undefined
  }, [cls])

  const legendaryTreeName = useMemo(() => {
    if (!cls) return undefined
    return 'legendaryTree' in cls && cls.legendaryTree ? (cls.legendaryTree as string) : undefined
  }, [cls])

  const resolveTree = useMemo(() => {
    const allAbilities = SalvageUnionReference.Abilities.all()
    const levelOrder = (l: number | 'L' | 'G') => (typeof l === 'number' ? l : l === 'L' ? 90 : 99)
    return (treeName: string): TreeGroup | null => {
      const matching = allAbilities
        .filter((a) => a.tree === treeName)
        .sort((a, b) => levelOrder(a.level) - levelOrder(b.level))
      return matching.length > 0 ? { tree: treeName, abilities: matching } : null
    }
  }, [])

  const coreTrees = useMemo(
    () => coreTreeNames.map(resolveTree).filter(Boolean) as TreeGroup[],
    [coreTreeNames, resolveTree]
  )

  const advancedTree = useMemo(
    () => (advancedTreeName ? resolveTree(advancedTreeName) : null),
    [advancedTreeName, resolveTree]
  )

  const legendaryTree = useMemo(
    () => (legendaryTreeName ? resolveTree(legendaryTreeName) : null),
    [legendaryTreeName, resolveTree]
  )

  if (!cls) return null
  const hasCoreTrees = coreTrees.length > 0
  const hasSpecialTrees = !!advancedTree || !!legendaryTree
  if (!hasCoreTrees && !hasSpecialTrees) return null

  return (
    <div className="space-y-1.5">
      {coreTrees.map((group) => (
        <TreeSection key={group.tree} {...group} />
      ))}
      {hasSpecialTrees && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {advancedTree && <TreeSection {...advancedTree} />}
          {legendaryTree && <TreeSection {...legendaryTree} />}
        </div>
      )}
    </div>
  )
}
