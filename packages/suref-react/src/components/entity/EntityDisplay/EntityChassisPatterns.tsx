import type { SURefChassis, SURefEntity } from 'salvageunion-reference'
import { normalizePatternName } from 'salvageunion-reference'
import { Text } from '../../base/Text'
import { EntityDisplay } from './index'
import { cn } from '../../../utils/cn'

type EntityChassisPatternsProps = {
  patterns?: SURefChassis['patterns']
  headerFontSize?: string
  /** The chassis entity — used to render pattern listing cards */
  chassisEntity: SURefEntity
}

export function EntityChassisPatterns({
  patterns,
  headerFontSize,
  chassisEntity,
}: EntityChassisPatternsProps) {
  if (!patterns || patterns.length === 0) return null

  return (
    <div className="clear-both space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-su-grey-light" aria-hidden="true" />
        <Text variant="pseudoheader" className={cn(headerFontSize ?? 'text-lg')}>
          Patterns
        </Text>
        <div className="h-px flex-1 bg-su-grey-light" aria-hidden="true" />
      </div>
      <div className="grid grid-cols-1 gap-2">
        {patterns.map((pattern) => {
          const displayName = normalizePatternName(pattern.name)

          return (
            <EntityDisplay
              key={pattern.name}
              data={chassisEntity}
              listing
              compact
              hideActions
              hidePatterns
              patternOverride={{
                name: displayName,
                systems: pattern.systems,
                modules: pattern.modules,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
