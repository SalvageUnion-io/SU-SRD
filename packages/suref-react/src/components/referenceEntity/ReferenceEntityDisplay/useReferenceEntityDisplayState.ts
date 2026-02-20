import { useMemo } from 'react'
import type { SURefEnumSource } from 'salvageunion-reference'
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
import { calculateBackgroundColor } from '../referenceEntityHelpers'
import {
  getReferenceEntityFontSizes,
  getReferenceEntitySpacing,
} from './referenceEntityDisplayTypes'
import type {
  ReferenceEntityDisplayState,
  ReferenceEntityDisplayStateInput,
} from './referenceEntityDisplayTypes'

// Re-export for consumers that import from this file
export type { ReferenceEntityDisplayStateInput } from './referenceEntityDisplayTypes'

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

export function useReferenceEntityDisplayState({
  data,
  schemaName,
  compact,
  headerColor,
  dimHeader,
  disabled,
  hide,
  listing,
  damaged = false,
  label,
  titleOverride,
  subtitleExtra,
  statsOverride,
  primaryStatsOnly,
  abilitiesSection,
  afterExtraContent,
  afterChoicesContent,
  footerOverride,
  titleSlot,
}: ReferenceEntityDisplayStateInput): ReferenceEntityDisplayState {
  const hideActions = hide?.actions ?? false
  const hidePatterns = hide?.patterns ?? false
  const hideDamagedEffect = hide?.damagedEffect ?? false
  const hideChoices = hide?.choices ?? false
  const hideStats = hide?.stats ?? false
  const hideContent = hide?.content ?? false
  const hideRollTable = hide?.rollTable ?? false
  const hideFooter = hide?.footer ?? false

  const title = titleOverride
    ? titleOverride
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
    'guideColor' in data && typeof data.guideColor === 'string' ? data.guideColor : undefined
  const spacing = getReferenceEntitySpacing(compact)
  const fontSize = getReferenceEntityFontSizes(compact)
  const opacity = { header: dimHeader ? 0.5 : 1, content: disabled ? 0.5 : 1 }
  const shouldShowExtraContent = compact ? !hideActions : true

  // Always use the original data name for action matching, not the display title.
  // Custom names (via titleOverride) are for display only — action matching must
  // compare against the canonical entity name so flat rendering still works.
  const entityName = 'name' in data ? String(data.name) : ''

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
    hide: {
      actions: hideActions,
      patterns: hidePatterns,
      damagedEffect: hideDamagedEffect,
      choices: hideChoices,
      stats: hideStats,
      content: hideContent,
      rollTable: hideRollTable,
      footer: hideFooter,
    },
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
    subtitleExtra,
    statsOverride,
    primaryStatsOnly,
    abilitiesSection,
    afterExtraContent,
    afterChoicesContent,
    footerOverride,
    titleSlot,
  }
}
