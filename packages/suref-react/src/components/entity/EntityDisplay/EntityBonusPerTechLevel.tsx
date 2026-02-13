import type { SURefObjectBonusPerTechLevel } from 'salvageunion-reference'
import { EntityStats } from './EntityStats'
import { cn } from '../../../utils/cn'
import type { getEntitySpacing } from './entityDisplayTypes'

type EntityBonusPerTechLevelProps = {
  bonusPerTechLevel?: SURefObjectBonusPerTechLevel
  spacing: ReturnType<typeof getEntitySpacing>
  compact: boolean
  techLevel?: number | 'B' | 'N'
}

export function EntityBonusPerTechLevel({
  bonusPerTechLevel,
  spacing,
  compact,
  techLevel,
}: EntityBonusPerTechLevelProps) {
  if (!bonusPerTechLevel) return null

  return (
    <div className={cn('rounded-md', spacing.smallSpaceYClass)}>
      <EntityStats
        label="Bonus Per Tech Level"
        prefix="+"
        data={bonusPerTechLevel}
        compact={compact}
        techLevel={techLevel}
      />
    </div>
  )
}
