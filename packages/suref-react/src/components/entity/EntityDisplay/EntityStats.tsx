import { StatDisplay } from '../../shared/StatDisplay'
import type { SURefObjectBonusPerTechLevel, SURefMetaEntity } from 'salvageunion-reference'
import { getSalvageValue } from 'salvageunion-reference'
import { Text } from '../../base/Text'
import { ENTITY_STATS_CONFIG, applyStatLabel } from './entityStatsConfig'
import { cn } from '../../../utils/cn'

export type EntityStatsProps = {
  data: SURefMetaEntity | SURefObjectBonusPerTechLevel
  compact: boolean
  techLevel?: number | 'B' | 'N'
  label?: string
  prefix?: string
}

export function EntityStats({
  data,
  compact,
  techLevel,
  label = '',
  prefix = '',
}: EntityStatsProps) {
  const entityData = data as SURefMetaEntity
  const isBioTechLevel = techLevel === 'B'
  const salvageValue = getSalvageValue(entityData)
  const hasBioSalvage = isBioTechLevel && salvageValue !== undefined

  return (
    <div className="flex items-center justify-end gap-1">
      {label && (
        <Text variant="pseudoheader" as="span" className={cn(compact ? 'text-xs' : 'text-sm')}>
          {label}
        </Text>
      )}
      {ENTITY_STATS_CONFIG.map((config, index) => {
        const value = config.getter(entityData)
        const displayValue = applyStatLabel(value, prefix)
        const isSalvageValue = config.getter === getSalvageValue

        // Special handling for bio salvage value
        if (isSalvageValue && hasBioSalvage) {
          return (
            <StatDisplay
              key={index}
              label={compact ? 'BSV' : 'BIO-SALVAGE'}
              bottomLabel={compact ? '' : 'VALUE'}
              value={displayValue}
              compact={compact}
              hoverText={config.tooltip}
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
            hoverText={config.tooltip}
          />
        )
      })}
    </div>
  )
}
