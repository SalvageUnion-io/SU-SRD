import type { SURefObjectBonusPerTechLevel } from 'salvageunion-reference'
import { ReferenceEntityStats } from './ReferenceEntityStats'
import { cn } from '../../../utils/cn'
import type { getReferenceEntitySpacing } from './referenceEntityDisplayTypes'
import { useDisplaySpacing } from './displayStateContext'

type ReferenceEntityBonusPerTechLevelProps = {
  bonusPerTechLevel?: SURefObjectBonusPerTechLevel
  /** Optional override; falls back to the card display-state context. */
  spacing?: ReturnType<typeof getReferenceEntitySpacing>
  compact: boolean
  techLevel?: number | 'B' | 'N'
}

export function ReferenceEntityBonusPerTechLevel({
  bonusPerTechLevel,
  spacing: spacingProp,
  compact,
  techLevel,
}: ReferenceEntityBonusPerTechLevelProps) {
  const spacing = useDisplaySpacing(spacingProp, compact)
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
