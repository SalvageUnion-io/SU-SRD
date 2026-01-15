import { Flex } from '@chakra-ui/react'
import { StatDisplay } from '../../StatDisplay'
import { LevelDisplay } from '../../shared/LevelDisplay'
import { useEntityDisplayContext } from './useEntityDisplayContext'

export function EntityLeftContent() {
  const { techLevel, compact, data, hideLevel } = useEntityDisplayContext()
  const level = 'level' in data ? data.level : undefined

  const hasTechLevel = !!techLevel
  const hasLevel = !!level && !hideLevel
  const isBioTechLevel = ('techLevel' in data && data.techLevel === 'B') || techLevel === 'B'
  const isNTechLevel = ('techLevel' in data && data.techLevel === 'N') || techLevel === 'N'

  if (!hasTechLevel && !hasLevel) return null
  return (
    <Flex alignItems="center" gap={compact ? 1 : 2}>
      {hasLevel && <LevelDisplay level={level!} compact={compact} inline />}
      {hasTechLevel && (
        <StatDisplay
          inverse={!isBioTechLevel && !isNTechLevel}
          bg={isBioTechLevel ? 'su.sicklyYellow' : isNTechLevel ? 'su.silver' : undefined}
          valueColor={isBioTechLevel ? 'su.black' : isNTechLevel ? 'su.black' : undefined}
          label={compact ? 'TL' : 'Tech'}
          bottomLabel={compact ? '' : 'Level'}
          value={techLevel}
          compact={compact}
          hoverText="A Mech's Tech Level broadly represents how advanced it is. There are 6 Tech Levels, and Mechs of higher Tech Levels tend to be more powerful with higher statistics in one or multiple areas. Consequently, higher Tech Mechs are more expensive to build, upkeep, and repair."
        />
      )}
    </Flex>
  )
}
