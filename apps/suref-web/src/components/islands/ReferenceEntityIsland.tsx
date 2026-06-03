import { Suspense, useMemo } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { isAbility } from 'salvageunion-reference'
import {
  ReferenceEntityDisplay,
  ReferenceEntityCardSkeleton,
  getClassSelections,
  ClassAbilityTreeDisplay,
  EntityHrefProvider,
} from 'suref-react'
import { GameDataGate } from '../../lib/useGameData'
import { srdEntityHref } from '../../lib/entityHref'

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

  // (The static SEO/no-JS fallback is stripped globally in BaseLayout — on load
  // and after every view-transition navigation — so no per-island removal here.)

  return (
    <GameDataGate
      fallback={
        <div className="mx-auto w-full max-w-6xl p-4">
          <ReferenceEntityCardSkeleton compact={compact} />
        </div>
      }
    >
      <div className="mx-auto w-full max-w-6xl p-4">
        <Suspense fallback={<ReferenceEntityCardSkeleton compact={compact} />}>
          <EntityHrefProvider value={srdEntityHref}>
            <ReferenceEntityDisplay
              data={item}
              compact={compact}
              titleAs={titleAs}
              afterExtraContent={
                classEntity ? <ClassAbilityTreeDisplay classEntity={classEntity} /> : undefined
              }
              label={isAbility(item) && item.tree ? `${item.tree} tree` : undefined}
            />
          </EntityHrefProvider>
        </Suspense>
      </div>
    </GameDataGate>
  )
}
