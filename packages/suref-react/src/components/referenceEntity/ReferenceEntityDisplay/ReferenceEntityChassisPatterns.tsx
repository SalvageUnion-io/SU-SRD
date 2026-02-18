import type { SURefChassis, SURefEntity } from 'salvageunion-reference'
import { normalizePatternName } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from './index'
import { SectionSeparator } from './SectionSeparator'
import { useDetailModal } from './useDetailModal'
import { useChassisPatternConfig } from './useChassisPatternConfig'
import type { PatternOverrideData } from './referenceEntityDisplayTypes'

type ReferenceEntityChassisPatternsProps = {
  patterns?: SURefChassis['patterns']
  headerFontSize?: string
  /** The chassis entity — used to render pattern listing cards */
  chassisEntity: SURefEntity
}

export function ReferenceEntityChassisPatterns({
  patterns,
  headerFontSize,
  chassisEntity,
}: ReferenceEntityChassisPatternsProps) {
  if (!patterns || patterns.length === 0) return null

  return (
    <div className="clear-both space-y-4">
      <SectionSeparator label="Patterns" fontSize={headerFontSize} />
      <div className="grid grid-cols-1 gap-2">
        {patterns.map((pattern) => (
          <PatternListing key={pattern.name} chassisEntity={chassisEntity} pattern={pattern} />
        ))}
      </div>
    </div>
  )
}

function PatternListing({
  chassisEntity,
  pattern,
}: {
  chassisEntity: SURefEntity
  pattern: PatternOverrideData
}) {
  const displayName = normalizePatternName(pattern.name)
  const patternOverride = {
    name: displayName,
    systems: pattern.systems,
    modules: pattern.modules,
  }
  const patternConfig = useChassisPatternConfig(chassisEntity, patternOverride, true)
  const detailModal = useDetailModal(chassisEntity, {
    titleOverride: patternConfig?.titleOverride,
    subtitleExtra: patternConfig?.subtitleExtra,
    statsOverride: patternConfig?.statsOverride,
    primaryStatsOnly: false,
    abilitiesSection: patternConfig?.abilitiesSection,
    hide: { patterns: true },
  })

  return (
    <>
      <ReferenceEntityDisplay
        data={chassisEntity}
        listing
        compact
        hide={{ actions: true, patterns: true }}
        titleOverride={patternConfig?.titleOverride}
        subtitleExtra={patternConfig?.subtitleExtra}
        statsOverride={patternConfig?.statsOverride}
        primaryStatsOnly={patternConfig?.primaryStatsOnly}
        abilitiesSection={patternConfig?.abilitiesSection}
        controls={[detailModal.control]}
      />
      {detailModal.modal}
    </>
  )
}
