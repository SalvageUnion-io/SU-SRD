import { Suspense, useMemo } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { isAbility } from 'salvageunion-reference'
import { EntityDisplay, EntityCardSkeleton, getClassSelections } from 'suref-react'
import { ClassAbilitiesContent } from './classAbilitiesRenderer'

type EntityIslandProps = {
  item: SURefEntity
  compact?: boolean
}

export function EntityIsland({ item, compact = false }: EntityIslandProps) {
  const classSelections = useMemo(() => getClassSelections(item), [item])
  const hasClassContent = !!(classSelections.selectedClass || classSelections.selectedAdvancedClass)

  return (
    <div className="mx-auto w-full max-w-6xl p-4">
      <Suspense fallback={<EntityCardSkeleton compact={compact} />}>
        <EntityDisplay
          data={item}
          compact={compact}
          afterExtraContent={
            hasClassContent ? (
              <ClassAbilitiesContent
                compact={compact}
                selectedClass={classSelections.selectedClass}
                selectedAdvancedClass={classSelections.selectedAdvancedClass}
              />
            ) : undefined
          }
          label={isAbility(item) && item.tree ? `${item.tree} tree` : undefined}
        />
      </Suspense>
    </div>
  )
}
