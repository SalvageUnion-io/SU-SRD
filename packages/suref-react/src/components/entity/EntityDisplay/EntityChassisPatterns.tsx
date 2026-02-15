import type { SURefChassis, SURefEntity } from 'salvageunion-reference'
import { normalizePatternName } from 'salvageunion-reference'
import { EntityDisplay } from './index'
import { SectionSeparator } from './SectionSeparator'

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
      <SectionSeparator label="Patterns" fontSize={headerFontSize} />
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
