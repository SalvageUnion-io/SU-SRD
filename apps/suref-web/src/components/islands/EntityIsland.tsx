import { Suspense } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { isAbility } from 'salvageunion-reference'
import { EntityDisplay, EntityCardSkeleton } from 'suref-react'
import { classAbilitiesRenderer } from './classAbilitiesRenderer'

type EntityIslandProps = {
  item: SURefEntity
  compact?: boolean
}

export function EntityIsland({ item, compact = false }: EntityIslandProps) {
  return (
    <div className="mx-auto w-full max-w-6xl p-4">
      <Suspense fallback={<EntityCardSkeleton compact={compact} />}>
        <EntityDisplay
          data={item}
          compact={compact}
          classAbilitiesRenderer={classAbilitiesRenderer}
          label={isAbility(item) && item.tree ? `${item.tree} tree` : undefined}
        />
      </Suspense>
    </div>
  )
}
