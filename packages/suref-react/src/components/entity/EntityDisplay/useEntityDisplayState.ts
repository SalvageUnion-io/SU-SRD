import { useMemo } from 'react'
import type { SURefEntity, SURefEnumSchemaName, SURefEnumSource } from 'salvageunion-reference'
import {
  getTechLevel,
  getTechLevelNumber,
  getChassisAbilities,
  getEffects,
  getTable,
  getAssetUrl,
  extractVisibleActions,
  filterActionsExcludingName,
  getSource,
} from 'salvageunion-reference'
import { calculateBackgroundColor } from '../entityDisplayHelpers'
import { getEntityFontSizes, getEntitySpacing } from './entityDisplayTypes'
import type {
  EntityDisplayState,
  ClassAbilitiesRenderer,
  PatternOverrideData,
} from './entityDisplayTypes'

/**
 * Tech level to Tailwind bg class mapping
 */
export const techLevelColors: Record<number, string> = {
  1: 'bg-tl-1',
  2: 'bg-tl-2',
  3: 'bg-tl-3',
  4: 'bg-tl-4',
  5: 'bg-tl-5',
  6: 'bg-tl-6',
}

export type EntityDisplayStateInput = {
  data: SURefEntity
  schemaName: SURefEnumSchemaName
  compact: boolean
  headerColor?: string
  dimHeader: boolean
  disabled: boolean
  hideActions: boolean
  hidePatterns: boolean
  hideChoices: boolean
  listing: boolean
  damaged?: boolean
  label?: string
  classAbilitiesRenderer?: ClassAbilitiesRenderer
  patternOverride?: PatternOverrideData
  hideStats?: boolean
  hideContent?: boolean
}

export function useEntityDisplayState({
  data,
  schemaName,
  compact,
  headerColor,
  dimHeader,
  disabled,
  hideActions,
  hidePatterns,
  hideChoices,
  listing,
  damaged = false,
  label,
  classAbilitiesRenderer,
  patternOverride,
  hideStats = false,
  hideContent = false,
}: EntityDisplayStateInput): EntityDisplayState {
  const title = patternOverride
    ? `\u201C${patternOverride.name}\u201D`
    : !('name' in data)
      ? ''
      : schemaName === 'ability-tree-requirements'
        ? data.name + ' Tree Requirements'
        : (data.name ?? '')
  const techLevel = getTechLevel(data)
  const techLevelNumeric = getTechLevelNumber(data)
  const source = getSource(data) as SURefEnumSource | undefined
  const calculatedHeaderBg = calculateBackgroundColor(
    schemaName,
    headerColor,
    techLevelNumeric,
    data,
    techLevelColors
  )
  const headerBg = damaged ? 'bg-su-grey' : calculatedHeaderBg
  const headerBgColor =
    schemaName === 'guides' && 'guideColor' in data && typeof data.guideColor === 'string'
      ? data.guideColor
      : undefined
  const spacing = getEntitySpacing(compact)
  const fontSize = getEntityFontSizes(compact)
  const opacity = { header: dimHeader ? 0.5 : 1, content: disabled ? 0.5 : 1 }
  const shouldShowExtraContent = compact ? !hideActions : true

  const entityName = title || ('name' in data ? String(data.name) : '')

  const chassisAbilities = useMemo(() => getChassisAbilities(data), [data])

  const effects = getEffects(data)
  const table = getTable(data)
  const assetUrl = getAssetUrl(data)

  const visibleActions = useMemo(() => extractVisibleActions(data), [data])

  const actionsToDisplay = useMemo(() => {
    if (!visibleActions || visibleActions.length === 0) return undefined
    return filterActionsExcludingName(visibleActions, entityName)
  }, [visibleActions, entityName])

  const matchingAction = useMemo(() => {
    if (!visibleActions || visibleActions.length === 0) return undefined
    return visibleActions.find((a) => a.name === entityName || a.displayName === entityName)
  }, [visibleActions, entityName])

  return {
    data,
    schemaName,
    compact,
    title,
    techLevel,
    headerBg,
    headerBgColor,
    spacing,
    fontSize,
    opacity,
    shouldShowExtraContent,
    listing,
    hideActions,
    hidePatterns,
    hideChoices,
    damaged,
    disabled,
    chassisAbilities,
    effects,
    table,
    assetUrl,
    actionsToDisplay,
    matchingAction,
    source,
    label,
    classAbilitiesRenderer,
    patternOverride,
    hideStats,
    hideContent,
  }
}
