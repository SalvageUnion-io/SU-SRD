import { StatDisplay } from '../../shared/StatDisplay'
import { LevelDisplay } from '../../shared/LevelDisplay'
import { cn } from '../../../utils/cn'

type EntityLeftContentProps = {
  techLevel: number | 'B' | 'N' | undefined
  compact: boolean
  level?: number | string
  hideLevel: boolean
}

export function EntityLeftContent({
  techLevel,
  compact,
  level,
  hideLevel,
}: EntityLeftContentProps) {
  const hasTechLevel = !!techLevel
  const hasLevel = !!level && !hideLevel
  const isBioTechLevel = techLevel === 'B'
  const isNTechLevel = techLevel === 'N'

  if (!hasTechLevel && !hasLevel) return null
  return (
    <div className={cn('flex items-center', compact ? 'gap-1' : 'gap-2')}>
      {hasLevel && <LevelDisplay level={level!} compact={compact} inline />}
      {hasTechLevel && (
        <StatDisplay
          inverse={!isBioTechLevel && !isNTechLevel}
          bg={isBioTechLevel ? 'bg-su-sickly-yellow' : isNTechLevel ? 'bg-su-silver' : undefined}
          valueColor={isBioTechLevel ? 'text-su-black' : isNTechLevel ? 'text-su-black' : undefined}
          label={compact ? 'TL' : 'Tech'}
          bottomLabel={compact ? '' : 'Level'}
          value={techLevel}
          compact={compact}
          hoverText="A Mech's Tech Level broadly represents how advanced it is. There are 6 Tech Levels, and Mechs of higher Tech Levels tend to be more powerful with higher statistics in one or multiple areas. Consequently, higher Tech Mechs are more expensive to build, upkeep, and repair."
        />
      )}
    </div>
  )
}
