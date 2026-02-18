import { resolveFormationMember, normalizePatternName, getFormation } from 'salvageunion-reference'
import type { SURefMetaEntity, SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from './index'
import { SectionSeparator } from './SectionSeparator'
import { useDetailModal } from './useDetailModal'
import { useChassisPatternConfig } from './useChassisPatternConfig'
import type { PatternOverrideData } from './referenceEntityDisplayTypes'
import { cn } from '../../../utils/cn'

type ReferenceEntityFormationProps = {
  data: SURefMetaEntity
  headerFontSize?: string
  compact?: boolean
}

export function ReferenceEntityFormation({
  data,
  headerFontSize,
  compact = false,
}: ReferenceEntityFormationProps) {
  const formation = getFormation(data)
  if (!formation || formation.length === 0) return null

  return (
    <div className="space-y-4">
      <SectionSeparator label="Formation" fontSize={headerFontSize} compact={compact} />
      <div className={cn('grid grid-cols-1 gap-2', !compact && 'lg:grid-cols-2')}>
        {formation.flatMap((mech, mechIdx) => {
          const count = mech.quantity ?? 1
          const resolved = resolveFormationMember(mech)
          return Array.from({ length: count }, (_, copyIdx) => {
            if (!resolved) {
              return (
                <div key={`${mechIdx}-${copyIdx}`} className="rounded border p-2 text-sm">
                  {mech.chassis}
                  {mech.pattern && <> &mdash; {mech.pattern}</>} (p.{mech.page})
                </div>
              )
            }
            const patternOverride = resolved.pattern
              ? {
                  name: normalizePatternName(resolved.pattern.name),
                  systems: resolved.pattern.systems,
                  modules: resolved.pattern.modules,
                }
              : undefined
            return (
              <FormationMechListing
                key={`${resolved.entity.id}-${mechIdx}-${copyIdx}`}
                entity={resolved.entity}
                patternOverride={patternOverride}
              />
            )
          })
        })}
      </div>
    </div>
  )
}

function FormationMechListing({
  entity,
  patternOverride,
}: {
  entity: SURefEntity
  patternOverride?: PatternOverrideData
}) {
  const patternConfig = useChassisPatternConfig(entity, patternOverride, true)
  const detailModal = useDetailModal(entity, {
    titleOverride: patternConfig?.titleOverride,
    subtitleExtra: patternConfig?.subtitleExtra,
    statsOverride: patternConfig?.statsOverride,
    primaryStatsOnly: false,
    abilitiesSection: patternConfig?.abilitiesSection,
    hide: patternConfig ? { patterns: true } : undefined,
  })

  return (
    <>
      <ReferenceEntityDisplay
        data={entity}
        compact
        listing
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
