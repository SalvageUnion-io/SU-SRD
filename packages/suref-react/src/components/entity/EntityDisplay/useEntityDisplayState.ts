import { useMemo } from 'react'
import type { ReactNode } from 'react'
import type {
  SURefEntity,
  SURefEnumSchemaName,
  SURefEnumSource,
  SURefObjectPatternSystemModule,
} from 'salvageunion-reference'
import {
  getTechLevel,
  getTechLevelNumber,
  hasActions,
  getChassisAbilities,
  getEffects,
  getTable,
  getAssetUrl,
  extractVisibleActions,
  filterActionsExcludingName,
  findActionByName,
  getSource,
} from 'salvageunion-reference'
import {
  calculateBackgroundColor,
  extractName,
  calculateOpacity,
  shouldShowExtraContent as calculateShouldShowExtraContent,
  createHeaderClickHandler,
  getEntityDisplayName,
} from '../entityDisplayHelpers'
import { getEntityFontSizes, getEntitySpacing } from './entityDisplayTypes'
import type {
  EntityDisplayState,
  ClassAbilitiesRenderer,
  EntityButtonConfig,
  EntityImageComponent,
} from './entityDisplayTypes'

/**
 * Tech level to Tailwind bg class mapping
 */
const techLevelColors: Record<number, string> = {
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
  collapsible: boolean
  onClick?: () => void
  hideLevel: boolean
  rightContent?: ReactNode
  damaged?: boolean
  buttonConfig?: EntityButtonConfig
  userChoices?: Record<string, string> | null
  imageWidth?: string
  label?: string
  classAbilitiesRenderer?: ClassAbilitiesRenderer
  imageComponent?: EntityImageComponent
  patternOverride?: {
    name: string
    systems: SURefObjectPatternSystemModule[]
    modules: SURefObjectPatternSystemModule[]
  }
  hideStats?: boolean
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
  collapsible,
  onClick,
  hideLevel,
  rightContent,
  damaged = false,
  buttonConfig,
  userChoices,
  imageWidth,
  label,
  classAbilitiesRenderer,
  imageComponent,
  patternOverride,
  hideStats = false,
}: EntityDisplayStateInput): EntityDisplayState {
  const isExpanded = !collapsible

  const title = patternOverride
    ? `\u201C${patternOverride.name}\u201D`
    : extractName(data, schemaName)
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
  const spacing = getEntitySpacing(compact)
  const fontSize = getEntityFontSizes(compact)
  const opacity = calculateOpacity(dimHeader, disabled)
  const shouldShowExtraContent = calculateShouldShowExtraContent(compact, hideActions)
  const handleHeaderClick = createHeaderClickHandler(onClick, disabled)

  const entityName = useMemo(() => getEntityDisplayName(data, title), [data, title])

  const hasActionsValue = useMemo(() => hasActions(data), [data])

  const chassisAbilities = useMemo(() => getChassisAbilities(data), [data])

  const effects = useMemo(() => getEffects(data), [data])

  const table = useMemo(() => getTable(data), [data])

  const assetUrl = useMemo(() => getAssetUrl(data), [data])

  const visibleActions = useMemo(() => extractVisibleActions(data), [data])

  const actionsToDisplay = useMemo(() => {
    if (!visibleActions || visibleActions.length === 0) return undefined
    return filterActionsExcludingName(visibleActions, entityName)
  }, [visibleActions, entityName])

  const matchingAction = useMemo(() => {
    if (!hasActionsValue) return undefined
    return findActionByName(data, entityName)
  }, [hasActionsValue, data, entityName])

  return {
    data,
    schemaName,
    compact,
    title,
    techLevel,
    headerBg,
    spacing,
    fontSize,
    contentBg: 'bg-su-white',
    opacity,
    shouldShowExtraContent,
    handleHeaderClick,
    isExpanded,
    collapsible,
    hideActions,
    hidePatterns,
    hideChoices,
    hideLevel,
    rightContent,
    damaged,
    disabled,
    buttonConfig,
    userChoices,
    imageWidth,
    hasActions: hasActionsValue,
    chassisAbilities,
    effects,
    table,
    assetUrl,
    actionsToDisplay,
    matchingAction,
    source,
    label,
    classAbilitiesRenderer,
    imageComponent,
    patternOverride,
    hideStats,
  }
}
