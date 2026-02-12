import { EntityStats } from './EntityStats'
import { useEntityDisplayContext } from './useEntityDisplayContext'
import { cn } from '../../../utils/cn'

export function EntityBonusPerTechLevel() {
  const { data, spacing } = useEntityDisplayContext()
  const showBPTL = 'bonusPerTechLevel' in data && data.bonusPerTechLevel && data.bonusPerTechLevel

  if (!showBPTL) return null

  return (
    <div className={cn('rounded-md', spacing.smallSpaceYClass)}>
      {data.bonusPerTechLevel && (
        <EntityStats label="Bonus Per Tech Level" prefix="+" data={data.bonusPerTechLevel} />
      )}
    </div>
  )
}
