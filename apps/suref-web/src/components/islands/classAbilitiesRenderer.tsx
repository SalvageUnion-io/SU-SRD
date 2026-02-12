import { useMemo } from 'react'
import type { SURefAbility } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntityDisplay, Text } from 'suref-react'
import type { ClassAbilitiesRenderer } from 'suref-react'

// eslint-disable-next-line react-refresh/only-export-components
function ClassAbilities({
  selectedClass,
  selectedAdvancedClass,
}: Parameters<ClassAbilitiesRenderer>[0]) {
  const cls = selectedClass || selectedAdvancedClass

  const treeNames = useMemo(() => {
    if (!cls) return []
    const trees: string[] = []
    if ('coreTrees' in cls && Array.isArray(cls.coreTrees)) {
      trees.push(...cls.coreTrees)
    }
    if ('advancedTree' in cls && cls.advancedTree) {
      trees.push(cls.advancedTree as string)
    }
    if ('legendaryTree' in cls && cls.legendaryTree) {
      trees.push(cls.legendaryTree as string)
    }
    return trees
  }, [cls])

  const abilitiesByTree = useMemo(() => {
    const allAbilities = SalvageUnionReference.Abilities.all()
    const grouped: { tree: string; abilities: SURefAbility[] }[] = []
    for (const tree of treeNames) {
      const levelOrder = (l: number | 'L' | 'G') =>
        typeof l === 'number' ? l : l === 'L' ? 90 : 99
      const matching = allAbilities
        .filter((a) => a.tree === tree)
        .sort((a, b) => levelOrder(a.level) - levelOrder(b.level))
      if (matching.length > 0) {
        grouped.push({ tree, abilities: matching })
      }
    }
    return grouped
  }, [treeNames])

  if (!cls || abilitiesByTree.length === 0) return null

  return (
    <div className="space-y-1.5">
      {abilitiesByTree.map(({ tree, abilities }) => (
        <div key={tree} className="space-y-1.5 pt-2">
          <div>
            <Text variant="pseudoheader" as="span" className="py-0.5 text-sm">
              {tree} Tree
            </Text>
          </div>
          {abilities.map((ability) => (
            <EntityDisplay
              key={ability.id}
              data={ability}
              compact
              collapsible
              defaultExpanded={false}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export const classAbilitiesRenderer: ClassAbilitiesRenderer = (props) => (
  <ClassAbilities {...props} />
)
