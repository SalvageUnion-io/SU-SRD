import type { SURefMetaAction } from 'salvageunion-reference'
import { space } from '../../../design/tokens'
import { ReferenceEntityCard } from '../card/ReferenceEntityCard'
import { getReferenceEntitySpacing, stackClassName } from '../referenceEntityTypes'

type ChassisAbilitiesContentProps = {
  chassisName?: string
  compact: boolean
  chassisAbilities?: SURefMetaAction[]
}

export function ChassisAbilitiesContent({
  chassisName,
  compact,
  chassisAbilities,
}: ChassisAbilitiesContentProps) {
  const spacing = getReferenceEntitySpacing(compact)
  if (!chassisAbilities || chassisAbilities.length === 0) return null

  return (
    <div className={stackClassName(spacing.smallGap)} style={{ marginTop: space[16] }}>
      {/* A chassis ability is an action: an inline ink band in the pattern card
          this section fills (board E2), not a framed card of its own. */}
      {chassisAbilities.map((ability) => (
        <ReferenceEntityCard
          inline
          size="medium"
          depth={1}
          key={ability.id}
          data={ability}
          chassisName={chassisName}
        />
      ))}
    </div>
  )
}
