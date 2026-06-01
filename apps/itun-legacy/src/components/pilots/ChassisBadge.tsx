import { Text } from 'suref-react'
import type { ChassisBadgeProps } from './pilotDisplayUtils'

export function ChassisBadge({ chassisName, patternName, badgeTextClass }: ChassisBadgeProps) {
  return (
    <span className="inline-flex shrink-0 cursor-default whitespace-nowrap border border-su-black">
      <Text
        variant="pseudoheader"
        as="span"
        className={badgeTextClass}
        style={{ backgroundColor: 'rgb(122, 151, 138)' }}
      >
        {chassisName}
      </Text>
      {patternName && (
        <Text variant="pseudoheaderInverse" as="span" className={badgeTextClass}>
          {patternName}
        </Text>
      )}
    </span>
  )
}
