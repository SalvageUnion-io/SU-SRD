import type { SURefChassis, SURefEntity } from 'salvageunion-reference'
import { normalizePatternName } from 'salvageunion-reference'
import { EntityDisplay } from './index'
import { SectionSeparator } from './SectionSeparator'
import { useDetailModal } from './useDetailModal'
import type { PatternOverrideData } from './entityDisplayTypes'

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
  const detailModal = useDetailModal(chassisEntity, { patternOverride })

  return (
    <>
      <EntityDisplay
        data={chassisEntity}
        listing
        compact
        hideActions
        hidePatterns
        patternOverride={patternOverride}
        controls={[detailModal.control]}
      />
      {detailModal.modal}
    </>
  )
}
