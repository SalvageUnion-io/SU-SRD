import type { SURefChassis, SURefEntity } from 'salvageunion-reference'
import { normalizePatternName } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from './index'
import { SectionSeparator } from './SectionSeparator'
import { useDetailModal } from './useDetailModal'
import { useChassisPatternConfig } from './useChassisPatternConfig'
import { EntityDetailLinkProvider } from './entityHrefContext'
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
  const listingConfig = useChassisPatternConfig(chassisEntity, patternOverride, true)
  const modalConfig = useChassisPatternConfig(chassisEntity, patternOverride, false)
  const detailModal = useDetailModal(chassisEntity, {
    titleOverride: modalConfig?.titleOverride,
    subtitleExtra: modalConfig?.subtitleExtra,
    statsOverride: modalConfig?.statsOverride,
    primaryStatsOnly: false,
    abilitiesSection: modalConfig?.abilitiesSection,
    afterExtraContent: modalConfig?.afterExtraContent,
    hide: { patterns: true },
    // A pattern is a modal-only configured view of the chassis (per-pattern
    // title, stats, loadout) with no standalone URL — its `data` is the chassis
    // itself. Force the detail to stay a modal even where the app enables link
    // mode (suref-web); linking out would just reopen the same chassis page and
    // drop the pattern-specific view. This must be an explicit option because
    // the `EntityDetailLinkProvider` below only wraps the returned JSX — this
    // hook runs above it and would otherwise read the ambient link mode.
    forceModal: true,
  })

  // The provider keeps nested cards inside the listing/modal from linking out.
  return (
    <EntityDetailLinkProvider value={false}>
      <ReferenceEntityDisplay
        data={chassisEntity}
        listing
        compact
        hide={{ actions: true, patterns: true }}
        titleOverride={listingConfig?.titleOverride}
        subtitleExtra={listingConfig?.subtitleExtra}
        statsOverride={listingConfig?.statsOverride}
        primaryStatsOnly={listingConfig?.primaryStatsOnly}
        abilitiesSection={listingConfig?.abilitiesSection}
        controls={[detailModal.control]}
      />
      {detailModal.modal}
    </EntityDetailLinkProvider>
  )
}
