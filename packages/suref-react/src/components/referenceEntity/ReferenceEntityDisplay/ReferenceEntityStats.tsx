import type { SURefObjectBonusPerTechLevel, SURefMetaEntity } from 'salvageunion-reference'
import { Text } from '../../base/Text'
import { StatsBar } from '../../shared/StatsBar'
import { buildReferenceEntityStats } from './referenceEntityStatsConfig'
import type { SvOverride } from './referenceEntityStatsConfig'
import { cn } from '../../../utils/cn'

export type { SvOverride }

export type ReferenceEntityStatsProps = {
  data: SURefMetaEntity | SURefObjectBonusPerTechLevel
  compact: boolean
  listing?: boolean
  techLevel?: number | 'B' | 'N'
  label?: string
  prefix?: string
  primaryOnly?: boolean
  svOverride?: SvOverride
}

export function ReferenceEntityStats({
  data,
  compact,
  listing = false,
  techLevel,
  label = '',
  prefix = '',
  primaryOnly = false,
  svOverride,
}: ReferenceEntityStatsProps) {
  const stats = buildReferenceEntityStats(data, {
    compact,
    listing,
    primaryOnly,
    svOverride,
    techLevel,
    prefix,
  })

  if (stats.length === 0) return null

  return (
    <div className={cn('flex items-center justify-end', compact ? 'gap-0.5' : 'gap-2')}>
      {label && (
        <Text variant="pseudoheader" as="span" className={cn(compact ? 'text-xs' : 'text-sm')}>
          {label}
        </Text>
      )}
      <StatsBar stats={stats} compact={compact} suppressTooltips={compact && listing} />
    </div>
  )
}
