import { useMemo } from 'react'
import type { ReactNode } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { normalizePatternName, getChassisAbilities } from 'salvageunion-reference'
import { cn } from '../../../utils/cn'
import { Text } from '../../base/Text'
import { BlockContentRendererView } from '../BlockContentRendererView'
import { EntityChassisAbilitiesContent } from './EntityChassisAbilitiesContent'
import {
  resolvePatternOverride,
  checkLegalStartingMech,
  computeSvOverride,
} from './patternOverrideUtils'
import { getEntityFontSizes, getEntitySpacing } from './entityDisplayTypes'
import type { PatternOverrideData, EntityHideConfig } from './entityDisplayTypes'
import { DataValueDisplayView } from '../DataValueDisplayView'

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
  hide: Partial<EntityHideConfig>
}

/**
 * Encapsulates all pattern-override display logic for chassis entities.
 * Returns generic override props that callers spread onto EntityDisplay, or null when no patternOverride.
 */
export function useChassisPatternConfig(
  data: SURefEntity,
  patternOverride: PatternOverrideData | undefined,
  compact: boolean
): ChassisPatternConfig | null {
  const spacing = useMemo(() => getEntitySpacing(compact), [compact])
  const fontSize = useMemo(() => getEntityFontSizes(compact), [compact])
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

  if (!patternOverride) return null

  const hasChassisAbilities = !!chassisAbilities && chassisAbilities.length > 0

  const titleOverride = `\u201C${patternOverride.name}\u201D`

  const subtitleExtra = (
    <>
      {isLegalStartingMech && (
        <DataValueDisplayView
          item={{ label: 'Legal Starting Mech', type: 'meta' }}
          compact={compact}
        />
      )}
      {chassisName && (
        <DataValueDisplayView
          item={{ label: `${chassisName} Chassis`, type: 'meta' }}
          compact={compact}
        />
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
          <EntityChassisAbilitiesContent
            chassisName={chassisName}
            spacing={spacing}
            compact={compact}
            chassisAbilities={chassisAbilities}
            droneEquipment={overridePatternData?.drone}
          />
        )}
      </div>
    ) : null

  return {
    titleOverride,
    subtitleExtra,
    statsOverride,
    primaryStatsOnly,
    abilitiesSection,
    afterExtraContent: null,
    hide: { patterns: true },
  }
}
