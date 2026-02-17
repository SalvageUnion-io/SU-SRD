import type { ReactNode } from 'react'
import type {
  SURefClass,
  SURefEntity,
  SURefEnumSchemaName,
  SURefEnumSource,
  SURefMetaAction,
  SURefObjectPatternSystemModule,
  SURefObjectTable,
} from 'salvageunion-reference'
// Import functions for type extraction (typeof requires actual values, not types)
import type { getEffects } from 'salvageunion-reference'

export type ClassAbilitiesRenderer = (props: {
  compact: boolean
  selectedClass: SURefClass | undefined
  selectedAdvancedClass: SURefClass | undefined
}) => ReactNode

/**
 * Spacing helpers based on compact mode.
 * Returns Tailwind-friendly class strings instead of numeric Chakra spacing.
 */
export const getEntitySpacing = (compact: boolean) => ({
  /** Gap between small elements: 1.5 (compact) or 2 (normal) */
  smallGap: compact ? 1.5 : 2,
  /** Tailwind gap class: 'gap-1.5' (compact) or 'gap-2' (normal) */
  smallGapClass: compact ? 'gap-1.5' : ('gap-2' as const),
  /** Tailwind space-y class: 'space-y-1.5' (compact) or 'space-y-2' (normal) */
  smallSpaceYClass: compact ? 'space-y-1.5' : ('space-y-2' as const),
  /** Tailwind space-y class for section-level gaps: 'space-y-3' (compact) or 'space-y-4' (normal) */
  sectionSpaceYClass: compact ? 'space-y-3' : ('space-y-4' as const),
  /** Gap for minimal spacing: 0.25 (compact) or 0.5 (normal) */
  minimalGap: compact ? 0.25 : 0.5,
  /** Vertical padding for content: 0.5 (compact) or 0.75 (normal) */
  contentPadding: compact ? 0.5 : 0.75,
  /** Horizontal padding for content: 1 (compact) or 1.5 (normal) */
  contentPaddingX: compact ? 1 : 1.5,
})

/**
 * Font size helpers based on compact mode.
 * Returns Tailwind class names instead of Chakra size tokens.
 */
export const getEntityFontSizes = (compact: boolean) => ({
  /** Extra small text */
  xs: compact ? 'text-[10px]' : 'text-xs',
  /** Small text */
  sm: compact ? 'text-xs' : 'text-sm',
  /** Medium text */
  md: compact ? 'text-sm' : 'text-base',
  /** Large text */
  lg: compact ? 'text-base' : 'text-lg',
})

/** Pattern override data for patterned chassis display */
export type PatternOverrideData = {
  name: string
  systems: SURefObjectPatternSystemModule[]
  modules: SURefObjectPatternSystemModule[]
}

export type EntityDisplayState = {
  /** Entity data - only SURefEntity (not SURefMetaAction or SURefObjectSystemModule) */
  data: SURefEntity
  /** Schema name */
  schemaName: SURefEnumSchemaName
  /** Compact mode flag */
  compact: boolean
  /** Computed entity name */
  title: string
  /** Computed tech level (can be number, 'B' for Bio, 'N' for N tech level, or undefined) */
  techLevel: number | 'B' | 'N' | undefined
  /** Computed header background color */
  headerBg: string
  /** Raw CSS color for header/footer background (e.g. guide's guideColor hex) */
  headerBgColor?: string
  /** Spacing values */
  spacing: ReturnType<typeof getEntitySpacing>
  /** Font size values */
  fontSize: ReturnType<typeof getEntityFontSizes>
  /** Computed opacity values */
  opacity: { header: number; content: number }
  /** Whether to show extra content sections */
  shouldShowExtraContent: boolean
  /** Whether only the header is shown (click opens detail modal) */
  listing: boolean
  /** Whether to hide actions */
  hideActions: boolean
  /** Whether to hide chassis patterns */
  hidePatterns: boolean
  /** Whether to hide the damaged effect section */
  hideDamagedEffect: boolean
  /** Whether to hide choices */
  hideChoices: boolean
  /** Whether the entity is damaged */
  damaged: boolean
  /** Whether the component is disabled */
  disabled: boolean
  /** Array of chassis abilities (or undefined) */
  chassisAbilities?: SURefMetaAction[]
  /** Array of effects (or undefined) */
  effects?: ReturnType<typeof getEffects>
  /** Table data (or undefined) */
  table?: SURefObjectTable
  /** Asset URL string (or undefined) */
  assetUrl?: string
  /** Filtered actions excluding entity name (or undefined) */
  actionsToDisplay?: SURefMetaAction[]
  /** Action with matching name for content replacement (or undefined) */
  matchingAction?: SURefMetaAction
  /** Source book for source-based styling */
  source?: SURefEnumSource
  /** Optional label rendered above the card */
  label?: string
  /** Optional renderer for class abilities (provided by consuming app) */
  classAbilitiesRenderer?: ClassAbilitiesRenderer
  /** Optional pattern override for patterned chassis display */
  patternOverride?: PatternOverrideData
  /** Whether to hide the stats/right content in the header */
  hideStats: boolean
  /** Whether to hide the entity's own content blocks (description) */
  hideContent: boolean
  /** Whether to hide roll tables */
  hideRollTable: boolean
}
