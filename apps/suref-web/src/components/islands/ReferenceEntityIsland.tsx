import { Suspense, useEffect, useMemo } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { isAbility } from 'salvageunion-reference'
import {
  ReferenceEntityDisplay,
  ReferenceEntityCardSkeleton,
  getClassSelections,
  ClassAbilityTreeDisplay,
} from 'suref-react'
import { GameDataGate } from '../../lib/useGameData'

type ReferenceEntityIslandProps = {
  item: SURefEntity
  compact?: boolean
  titleAs?: 'span' | 'h1'
}

export function ReferenceEntityIsland({
  item,
  compact = false,
  titleAs,
}: ReferenceEntityIslandProps) {
  const classSelections = useMemo(() => getClassSelections(item), [item])
  const classEntity = classSelections.selectedClass || classSelections.selectedAdvancedClass

  // Remove static fallback content after hydration
  useEffect(() => {
    document.querySelector('[data-static-fallback]')?.remove()
  }, [])

  return (
    <GameDataGate fallback={<div className="mx-auto w-full max-w-6xl p-4"><ReferenceEntityCardSkeleton compact={compact} /></div>}>
      <div className="mx-auto w-full max-w-6xl p-4">
        <Suspense fallback={<ReferenceEntityCardSkeleton compact={compact} />}>
          <ReferenceEntityDisplay
            data={item}
            compact={compact}
            titleAs={titleAs}
            afterExtraContent={
              classEntity ? <ClassAbilityTreeDisplay classEntity={classEntity} /> : undefined
            }
            label={isAbility(item) && item.tree ? `${item.tree} tree` : undefined}
          />
        </Suspense>
      </div>
    </GameDataGate>
  )
}
