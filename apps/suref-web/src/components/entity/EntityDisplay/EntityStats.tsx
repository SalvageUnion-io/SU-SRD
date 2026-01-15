import { Flex } from '@chakra-ui/react'
import { StatDisplay } from '../../StatDisplay'
import type { SURefObjectBonusPerTechLevel, SURefMetaEntity } from 'salvageunion-reference'
import { getSalvageValue } from 'salvageunion-reference'
import { Text } from '../../base/Text'
import { ENTITY_STATS_CONFIG, applyStatLabel } from './entityStatsConfig'
import { useEntityDisplayContext } from './useEntityDisplayContext'

export interface EntityStatsProps {
  data: SURefMetaEntity | SURefObjectBonusPerTechLevel
  label?: string
  prefix?: string
}

export function EntityStats({ data, label = '', prefix = '' }: EntityStatsProps) {
  const { compact, techLevel } = useEntityDisplayContext()

  const entityData = data as SURefMetaEntity
  const isBioTechLevel = techLevel === 'B'
  const salvageValue = getSalvageValue(entityData)
  const hasBioSalvage = isBioTechLevel && salvageValue !== undefined

  return (
    <Flex gap={1} justifyContent="flex-end" alignItems="center">
      {label && (
        <Text variant="pseudoheader" fontSize={compact ? 'xs' : 'sm'}>
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
              bg="su.sicklyYellow"
              valueColor="su.black"
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
    </Flex>
  )
}
