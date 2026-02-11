import { useState, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { SURefEntity, SURefEnumSchemaName, SURefEnumSource } from 'salvageunion-reference'
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
import { EntityDisplayContext, getEntityFontSizes, getEntitySpacing } from './entityDisplayContext'
import type {
  EntityDisplayContextValue,
  ClassAbilitiesRenderer,
  EntityButtonConfig,
} from './entityDisplayContext'

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

type EntityDisplayProviderProps = {
  data: SURefEntity
  schemaName: SURefEnumSchemaName
  compact: boolean
  headerColor?: string
  dimHeader: boolean
  disabled: boolean
  hideActions: boolean
  hidePatterns: boolean
  hideChoices: boolean
  showFooter?: boolean
  collapsible: boolean
  defaultExpanded: boolean
  onClick?: () => void
  hideLevel: boolean
  expanded?: boolean
  rightContent?: ReactNode
  damaged?: boolean
  buttonConfig?: EntityButtonConfig
  userChoices?: Record<string, string> | null
  children?: ReactNode
  imageWidth?: string
  classAbilitiesRenderer?: ClassAbilitiesRenderer
}

export function EntityDisplayProvider({
  data,
  schemaName,
  compact,
  headerColor,
  dimHeader,
  disabled,
  hideActions,
  hidePatterns,
  hideChoices,
  showFooter,
  collapsible,
  expanded,
  defaultExpanded,
  onClick,
  hideLevel,
  rightContent,
  damaged = false,
  buttonConfig,
  userChoices,
  children,
  imageWidth,
  classAbilitiesRenderer,
}: EntityDisplayProviderProps) {
  const hasButtonConfig = !!buttonConfig
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded)
  const isExpanded = expanded !== undefined ? expanded : internalExpanded

  const onToggle = () => {
    setInternalExpanded(!internalExpanded)
  }
  const title = extractName(data, schemaName)
  // Get tech level for display (preserves "B" and "N")
  const techLevel = getTechLevel(data)
  // Get numeric tech level for calculations (converts "B" and "N" to 1)
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
  const handleHeaderClick = createHeaderClickHandler(
    hasButtonConfig,
    collapsible,
    onClick,
    disabled,
    onToggle
  )

  // Memoize expensive computations
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

  const value: EntityDisplayContextValue = {
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
    showFooter,
    hideLevel,
    rightContent,
    damaged,
    disabled,
    buttonConfig,
    userChoices,
    imageWidth,
    entityName,
    hasActions: hasActionsValue,
    chassisAbilities,
    effects,
    table,
    assetUrl,
    visibleActions,
    actionsToDisplay,
    matchingAction,
    source,
    classAbilitiesRenderer,
  }

  return <EntityDisplayContext.Provider value={value}>{children}</EntityDisplayContext.Provider>
}
