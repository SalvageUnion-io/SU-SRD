import type { SURefEntity } from 'salvageunion-reference'
import { EntityStats } from './EntityStats'
import { cn } from '../../../utils/cn'
import type { getEntitySpacing } from './entityDisplayTypes'

type EntityBonusPerTechLevelProps = {
  data: SURefEntity
  spacing: ReturnType<typeof getEntitySpacing>
  compact: boolean
  techLevel?: number | 'B' | 'N'
}

export function EntityBonusPerTechLevel({
  data,
  spacing,
  compact,
  techLevel,
}: EntityBonusPerTechLevelProps) {
  const showBPTL = 'bonusPerTechLevel' in data && data.bonusPerTechLevel && data.bonusPerTechLevel

  if (!showBPTL) return null

  return (
    <div className={cn('rounded-md', spacing.smallSpaceYClass)}>
      {data.bonusPerTechLevel && (
        <EntityStats
          label="Bonus Per Tech Level"
          prefix="+"
          data={data.bonusPerTechLevel}
          compact={compact}
          techLevel={techLevel}
        />
      )}
    </div>
  )
}
