import type { SURefObjectBonusPerTechLevel } from 'salvageunion-reference'
import { ReferenceEntityStats } from './ReferenceEntityStats'
import { cn } from '../../../utils/cn'
import type { getReferenceEntitySpacing } from './referenceEntityDisplayTypes'

type ReferenceEntityBonusPerTechLevelProps = {
  bonusPerTechLevel?: SURefObjectBonusPerTechLevel
  spacing: ReturnType<typeof getReferenceEntitySpacing>
  compact: boolean
  techLevel?: number | 'B' | 'N'
}

export function ReferenceEntityBonusPerTechLevel({
  bonusPerTechLevel,
  spacing,
  compact,
  techLevel,
}: ReferenceEntityBonusPerTechLevelProps) {
  if (!bonusPerTechLevel) return null

  return (
    <div className={cn('rounded-md', spacing.smallSpaceYClass)}>
      <ReferenceEntityStats
        label="Bonus Per Tech Level"
        prefix="+"
        data={bonusPerTechLevel}
        compact={compact}
        techLevel={techLevel}
      />
    </div>
  )
}
