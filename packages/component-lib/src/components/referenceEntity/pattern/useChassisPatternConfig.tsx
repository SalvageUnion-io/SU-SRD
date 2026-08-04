import type { ReactNode } from 'react'
import { useMemo } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import {
  getChassisAbilities,
  normalizePatternName,
  SalvageUnionReference,
} from 'salvageunion-reference'
import { cn } from '../../../utils/cn'
import { Badge } from '../../chrome/Badge'
import { Slab } from '../../chrome/Slab'
import { Stat } from '../../shared/Stat'
import type { StatItem } from '../../shared/statsBarTypes'
import { Content } from '../Content'
import type { ReferenceEntityCardHideConfig } from '../card/ReferenceEntityCard'
import type { PatternOverrideData } from '../referenceEntityTypes'
import { getReferenceEntityFontSizes, getReferenceEntitySpacing } from '../referenceEntityTypes'
import { ChassisAbilitiesContent } from './ChassisAbilitiesContent'
import { PatternEquipmentItem } from './PatternEquipmentItem'
import { computeSvOverride, resolvePatternOverride } from './patternOverrideUtils'

type ChassisPatternConfig = {
  /** Override the title to the quoted pattern name */
  titleOverride: string
  /** Subtitle badges (chassis name + legal starting mech) */
  subtitleExtra: ReactNode
  /** SV override computed from pattern TL1 values, as a header stat */
  statsOverride: StatItem[]
  /** Show only primary stats in header */
  primaryStatsOnly: boolean
  /** The complete abilities section (pattern info + abilities + drone equipment) */
  abilitiesSection: ReactNode | null
  /** The pattern systems/modules block for extra content */
  afterExtraContent: ReactNode | null
  /** Hide config additions for pattern mode */
  hide: Partial<ReferenceEntityCardHideConfig>
}

/**
 * Encapsulates all pattern-override display logic for chassis entities.
 * Returns generic override props that callers spread onto ReferenceEntityCard, or null when no patternOverride.
 */
export function useChassisPatternConfig(
  data: SURefEntity,
  patternOverride: PatternOverrideData | undefined,
  compact: boolean
): ChassisPatternConfig | null {
  const spacing = useMemo(() => getReferenceEntitySpacing(compact), [compact])
  const fontSize = useMemo(() => getReferenceEntityFontSizes(compact), [compact])
  const chassisName = data.name

  // All hooks must be called unconditionally (before any early return)
  const overridePatternData = useMemo(
    () => (patternOverride ? resolvePatternOverride(data, patternOverride) : undefined),
    [data, patternOverride]
  )
  // "Legal Starting Pattern" is an explicit data tag on the pattern (set only
  // where the source book calls it out), not a value computed from tech level or
  // salvage value. The badge shows iff the resolved pattern record carries it.
  const isLegalStartingMech = overridePatternData?.legalStarting === true
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
            return Array.from({ length: count }, () => found)
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
            return Array.from({ length: count }, () => found)
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
        <Stat
          orientation="horizontal"
          label="Legal Starting Pattern"
          size={compact ? 'compact' : 'full'}
          inline={false}
          state="modified"
        />
      )}
      {chassisName && (
        <Stat
          orientation="horizontal"
          label="Chassis"
          value={chassisName}
          size={compact ? 'compact' : 'full'}
          inline={false}
        />
      )}
    </>
  )

  const sv = svOverride ?? { value: 0, bottomLabel: 'TL1' }
  const statsOverride: StatItem[] = [
    { key: 'sv-override', label: 'Salvage', bottomLabel: sv.bottomLabel, value: sv.value },
  ]
  const primaryStatsOnly = compact

  const abilitiesSection =
    hasChassisAbilities || overridePatternData ? (
      <div className={spacing.sectionSpaceYClass}>
        {overridePatternData && (
          <div className={spacing.smallSpaceYClass}>
            {/*
             * The row is `items-center`, so `self-start` is load-bearing: these
             * three stamps carry different font sizes and must stay TOP aligned,
             * not centred against the tallest. `leading-none` trails the font
             * size, which would otherwise reinstate its own line-height.
             */}
            <div className="flex items-center gap-2">
              <Badge
                shape="stamp"
                size="mini"
                className={cn(
                  compact ? 'text-xs' : 'text-sm',
                  'block self-start font-bold uppercase leading-none'
                )}
              >
                {normalizePatternName(overridePatternData.name)}
              </Badge>
              {overridePatternData.page && (
                <Badge
                  shape="stamp"
                  size="mini"
                  className="block self-start text-xs font-semibold uppercase leading-none"
                >
                  Page {overridePatternData.page}
                </Badge>
              )}
              {!compact && overridePatternData.source && (
                <Badge
                  shape="stamp"
                  size="mini"
                  className="block self-start text-xs font-semibold uppercase leading-none opacity-70"
                >
                  {overridePatternData.source}
                </Badge>
              )}
            </div>
            {overridePatternData.content && overridePatternData.content.length > 0 && (
              <Content
                body={overridePatternData.content}
                fontSize={fontSize.sm}
                compact={compact}
              />
            )}
          </div>
        )}
        {hasChassisAbilities && (
          <ChassisAbilitiesContent
            chassisName={chassisName}
            spacing={spacing}
            compact={compact}
            chassisAbilities={chassisAbilities}
            droneEquipment={overridePatternData?.drones}
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
            <Slab variant="solid" label="Systems" />
            {resolvedSystems.map((entity, idx) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static pattern list; index disambiguates duplicate system ids
              <PatternEquipmentItem key={`pat-sys-${entity.id}-${idx}`} data={entity} />
            ))}
          </div>
        )}
        {hasModules && (
          <div className={spacing.smallSpaceYClass}>
            <Slab variant="solid" label="Modules" />
            {resolvedModules.map((entity, idx) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static pattern list; index disambiguates duplicate module ids
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
