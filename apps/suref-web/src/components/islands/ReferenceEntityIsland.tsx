import { Suspense, useMemo } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { isAbility } from 'salvageunion-reference'
import {
  ReferenceEntityDisplay,
  ReferenceEntityCardSkeleton,
  getClassSelections,
  ClassAbilityTreeDisplay,
} from 'suref-react'

type ReferenceEntityIslandProps = {
  item: SURefEntity
  compact?: boolean
}

export function ReferenceEntityIsland({ item, compact = false }: ReferenceEntityIslandProps) {
  const classSelections = useMemo(() => getClassSelections(item), [item])
  const classEntity = classSelections.selectedClass || classSelections.selectedAdvancedClass

  return (
    <div className="mx-auto w-full max-w-6xl p-4">
      <Suspense fallback={<ReferenceEntityCardSkeleton compact={compact} />}>
        <ReferenceEntityDisplay
          data={item}
          compact={compact}
          afterExtraContent={
            classEntity ? <ClassAbilityTreeDisplay classEntity={classEntity} /> : undefined
          }
          label={isAbility(item) && item.tree ? `${item.tree} tree` : undefined}
        />
      </Suspense>
    </div>
  )
}
