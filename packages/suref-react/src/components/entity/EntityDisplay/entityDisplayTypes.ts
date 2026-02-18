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

/** Grouped NPC configuration props */
export type NpcConfig = {
  children?: ReactNode
  hpSlot?: ReactNode
  afterContent?: ReactNode
  damaged?: boolean
  name?: string
  onNameChange?: (name: string) => void
  onNameBlur?: () => void
  readOnly?: boolean
}

/** Grouped visibility toggle props */
export type EntityHideConfig = {
  actions?: boolean
  patterns?: boolean
  damagedEffect?: boolean
  choices?: boolean
  stats?: boolean
  content?: boolean
  rollTable?: boolean
  footer?: boolean
}

/** Pattern override data for patterned chassis display */
export type PatternOverrideData = {
  name: string
  systems: SURefObjectPatternSystemModule[]
  modules: SURefObjectPatternSystemModule[]
}

export type EntityDisplayState = {
  data: SURefEntity
  schemaName: SURefEnumSchemaName
  compact: boolean
  title: string
  techLevel: number | 'B' | 'N' | undefined
  headerBg: string
  headerBgColor?: string
  spacing: ReturnType<typeof getEntitySpacing>
  fontSize: ReturnType<typeof getEntityFontSizes>
  opacity: { header: number; content: number }
  shouldShowExtraContent: boolean
  listing: boolean
  hide: Required<EntityHideConfig>
  damaged: boolean
  disabled: boolean
  chassisAbilities?: SURefMetaAction[]
  effects?: ReturnType<typeof getEffects>
  table?: SURefObjectTable
  assetUrl?: string
  actionsToDisplay?: SURefMetaAction[]
  matchingAction?: SURefMetaAction
  source?: SURefEnumSource
  label?: string
  classAbilitiesRenderer?: ClassAbilitiesRenderer
  patternOverride?: PatternOverrideData
}
