import { EntityStats } from './EntityStats'
import { useEntityDisplayContext } from './useEntityDisplayContext'
import { cn } from '../../../utils/cn'

export function EntityBonusPerTechLevel() {
  const { data, spacing } = useEntityDisplayContext()
  const showBPTL = 'bonusPerTechLevel' in data && data.bonusPerTechLevel && data.bonusPerTechLevel

  if (!showBPTL) return null

  return (
    <div
      className={cn(
        'flex flex-col items-stretch rounded-md',
        spacing.smallGap <= 1.5 ? 'gap-1.5' : 'gap-2'
      )}
      style={{
        paddingLeft: `${spacing.contentPaddingX}rem`,
        paddingRight: `${spacing.contentPaddingX}rem`,
        paddingTop: `${spacing.contentPadding}rem`,
        paddingBottom: `${spacing.contentPadding}rem`,
      }}
    >
      {data.bonusPerTechLevel && (
        <EntityStats label="Bonus Per Tech Level" prefix="+" data={data.bonusPerTechLevel} />
      )}
    </div>
  )
}
