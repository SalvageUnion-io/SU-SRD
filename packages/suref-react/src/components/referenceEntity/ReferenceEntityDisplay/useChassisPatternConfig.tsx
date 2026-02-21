import { useMemo } from 'react'
import type { ReactNode } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import {
  normalizePatternName,
  getChassisAbilities,
  SalvageUnionReference,
} from 'salvageunion-reference'
import { cn } from '../../../utils/cn'
import { Text } from '../../base/Text'
import { BlockContentRendererView } from '../BlockContentRendererView'
import { ReferenceEntityChassisAbilitiesContent } from './ReferenceEntityChassisAbilitiesContent'
import {
  resolvePatternOverride,
  checkLegalStartingMech,
  computeSvOverride,
} from './patternOverrideUtils'
import {
  getReferenceEntityFontSizes,
  getReferenceEntitySpacing,
} from './referenceEntityDisplayTypes'
import type { PatternOverrideData, ReferenceEntityHideConfig } from './referenceEntityDisplayTypes'
import { DataValueDisplayView } from '../DataValueDisplayView'
import { SectionSeparator } from './SectionSeparator'
import { PatternEquipmentItem } from './PatternEquipmentItem'

type ChassisPatternConfig = {
  /** Override the title to the quoted pattern name */
  titleOverride: string
  /** Subtitle badges (chassis name + legal starting mech) */
  subtitleExtra: ReactNode
  /** SV override computed from pattern TL1 values */
  statsOverride: { value: number; bottomLabel: string }
  /** Show only primary stats in header */
  primaryStatsOnly: boolean
  /** The complete abilities section (pattern info + abilities + drone equipment) */
  abilitiesSection: ReactNode | null
  /** The pattern systems/modules block for extra content */
  afterExtraContent: ReactNode | null
  /** Hide config additions for pattern mode */
  hide: Partial<ReferenceEntityHideConfig>
}

/**
 * Encapsulates all pattern-override display logic for chassis entities.
 * Returns generic override props that callers spread onto ReferenceEntityDisplay, or null when no patternOverride.
 */
export function useChassisPatternConfig(
  data: SURefEntity,
  patternOverride: PatternOverrideData | undefined,
  compact: boolean
): ChassisPatternConfig | null {
  const spacing = useMemo(() => getReferenceEntitySpacing(compact), [compact])
  const fontSize = useMemo(() => getReferenceEntityFontSizes(compact), [compact])
  const chassisName = 'name' in data ? (data.name as string) : undefined

  // All hooks must be called unconditionally (before any early return)
  const overridePatternData = useMemo(
    () => (patternOverride ? resolvePatternOverride(data, patternOverride) : undefined),
    [data, patternOverride]
  )
  const isLegalStartingMech = useMemo(
    () => (patternOverride ? checkLegalStartingMech(data, patternOverride) : false),
    [data, patternOverride]
  )
  const svOverride = useMemo(
    () => (patternOverride ? computeSvOverride(data, patternOverride) : undefined),
    [data, patternOverride]
  )
  const chassisAbilities = useMemo(() => getChassisAbilities(data), [data])

  const resolvedSystems = useMemo(
    () =>
      patternOverride
        ? patternOverride.systems.flatMap((sys) => {
            const found = SalvageUnionReference.Systems.find((s) => s.name === sys.name)
            if (!found) return []
            const count = sys.count ?? 1
            return Array(count).fill(found) as SURefEntity[]
          })
        : [],
    [patternOverride]
  )

  const resolvedModules = useMemo(
    () =>
      patternOverride
        ? patternOverride.modules.flatMap((mod) => {
            const found = SalvageUnionReference.Modules.find((m) => m.name === mod.name)
            if (!found) return []
            const count = mod.count ?? 1
            return Array(count).fill(found) as SURefEntity[]
          })
        : [],
    [patternOverride]
  )

  if (!patternOverride) return null

  const hasChassisAbilities = !!chassisAbilities && chassisAbilities.length > 0

  const titleOverride = `\u201C${patternOverride.name}\u201D`

  const subtitleExtra = (
    <>
      {isLegalStartingMech && (
        <DataValueDisplayView
          item={{ label: 'Legal Starting Pattern', type: 'meta' }}
          compact={compact}
        />
      )}
      {chassisName && (
        <DataValueDisplayView item={{ label: 'Chassis', value: chassisName }} compact={compact} />
      )}
    </>
  )

  const statsOverride = svOverride ?? { value: 0, bottomLabel: 'TL1' }
  const primaryStatsOnly = compact

  const abilitiesSection =
    hasChassisAbilities || overridePatternData ? (
      <div className={spacing.sectionSpaceYClass}>
        {overridePatternData && (
          <div className={spacing.smallSpaceYClass}>
            <div className="flex items-center gap-2">
              <Text
                variant="pseudoheader"
                as="span"
                className={cn(compact ? 'text-xs' : 'text-sm', 'font-bold uppercase')}
              >
                {normalizePatternName(overridePatternData.name)} Pattern
              </Text>
              {overridePatternData.page && (
                <Text variant="pseudoheader" as="span" className="text-xs font-semibold uppercase">
                  Page {overridePatternData.page}
                </Text>
              )}
              {!compact && overridePatternData.source && (
                <Text
                  variant="pseudoheader"
                  as="span"
                  className="text-xs font-semibold uppercase opacity-70"
                >
                  {overridePatternData.source}
                </Text>
              )}
            </div>
            {overridePatternData.content && overridePatternData.content.length > 0 && (
              <BlockContentRendererView
                content={overridePatternData.content}
                fontSize={fontSize.sm}
                compact={compact}
              />
            )}
          </div>
        )}
        {hasChassisAbilities && (
          <ReferenceEntityChassisAbilitiesContent
            chassisName={chassisName}
            spacing={spacing}
            compact={compact}
            chassisAbilities={chassisAbilities}
            droneEquipment={overridePatternData?.drone}
            hideDrone
          />
        )}
      </div>
    ) : null

  const hasSystems = resolvedSystems.length > 0
  const hasModules = resolvedModules.length > 0

  const afterExtraContent =
    hasSystems || hasModules ? (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {hasSystems && (
          <div className={spacing.smallSpaceYClass}>
            <SectionSeparator label="Systems" fontSize="text-xs" />
            {resolvedSystems.map((entity, idx) => (
              <PatternEquipmentItem key={`pat-sys-${entity.id}-${idx}`} data={entity} />
            ))}
          </div>
        )}
        {hasModules && (
          <div className={spacing.smallSpaceYClass}>
            <SectionSeparator label="Modules" fontSize="text-xs" />
            {resolvedModules.map((entity, idx) => (
              <PatternEquipmentItem key={`pat-mod-${entity.id}-${idx}`} data={entity} />
            ))}
          </div>
        )}
      </div>
    ) : null

  return {
    titleOverride,
    subtitleExtra,
    statsOverride,
    primaryStatsOnly,
    abilitiesSection,
    afterExtraContent,
    hide: { patterns: true },
  }
}
