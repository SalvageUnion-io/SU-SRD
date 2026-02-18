import { StatDisplay } from '../../shared/StatDisplay'
import type { SURefObjectBonusPerTechLevel, SURefMetaEntity } from 'salvageunion-reference'
import { getSalvageValue } from 'salvageunion-reference'
import { Text } from '../../base/Text'
import { ENTITY_STATS_CONFIG, applyStatLabel } from './referenceEntityStatsConfig'
import { cn } from '../../../utils/cn'

export type SvOverride = {
  value: number | string
  bottomLabel: string
}

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
  const entityData = data as SURefMetaEntity
  const isBioTechLevel = techLevel === 'B'
  const salvageValue = getSalvageValue(entityData)
  const hasBioSalvage = isBioTechLevel && salvageValue !== undefined
  const suppressTooltips = compact && listing

  return (
    <div className={cn('flex items-center justify-end', compact ? 'gap-0.5' : 'gap-2')}>
      {label && (
        <Text variant="pseudoheader" as="span" className={cn(compact ? 'text-xs' : 'text-sm')}>
          {label}
        </Text>
      )}
      {ENTITY_STATS_CONFIG.map((config, index) => {
        if (primaryOnly && !config.primary) return null
        const isSalvageValue = config.getter === getSalvageValue

        // Use svOverride for the SV stat when provided
        if (isSalvageValue && svOverride) {
          const overrideDisplay = svOverride.value === 0 ? '-' : `${prefix}${svOverride.value}`
          return (
            <StatDisplay
              key={index}
              label={compact ? config.compactLabel : config.normalLabel}
              bottomLabel={svOverride.bottomLabel}
              value={overrideDisplay}
              compact={compact}
              hoverText={suppressTooltips ? undefined : config.tooltip}
            />
          )
        }

        const value = config.getter(entityData)
        const displayValue = applyStatLabel(value, prefix)

        // Special handling for bio salvage value
        if (isSalvageValue && hasBioSalvage) {
          return (
            <StatDisplay
              key={index}
              label={compact ? 'BSV' : 'BIO-SALVAGE'}
              bottomLabel={compact ? '' : 'VALUE'}
              value={displayValue}
              compact={compact}
              hoverText={suppressTooltips ? undefined : config.tooltip}
              bg="bg-su-sickly-yellow"
              valueColor="text-su-black"
              inverse={false}
            />
          )
        }

        return (
          <StatDisplay
            key={index}
            label={compact ? config.compactLabel : config.normalLabel}
            bottomLabel={compact ? config.compactBottomLabel : config.normalBottomLabel}
            value={displayValue}
            compact={compact}
            hoverText={suppressTooltips ? undefined : config.tooltip}
          />
        )
      })}
    </div>
  )
}
