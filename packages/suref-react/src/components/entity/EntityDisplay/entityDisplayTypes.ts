import type { ReactNode } from 'react'
import type {
  SURefClass,
  SURefEntity,
  SURefEnumSchemaName,
  SURefEnumSource,
  SURefMetaAction,
  SURefObjectPatternSystemModule,
  SURefObjectTable,
  getEffects,
} from 'salvageunion-reference'

export type ClassAbilitiesRenderer = (props: {
  compact: boolean
  selectedClass: SURefClass | undefined
  selectedAdvancedClass: SURefClass | undefined
}) => ReactNode

/**
 * Spacing helpers based on compact mode.
 * Returns Tailwind-friendly class strings instead of numeric Chakra spacing.
 */
export const getEntitySpacing = (compact: boolean) => {
  const contentPadding = compact ? 0.5 : 0.75
  const contentPaddingX = compact ? 1 : 1.5

  return {
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
    /** Vertical padding for content (rem): 0.5 (compact) or 0.75 (normal) */
    contentPadding,
    /** Horizontal padding for content (rem): 1 (compact) or 1.5 (normal) */
    contentPaddingX,
    /** Inline style for horizontal padding only */
    contentPaddingXStyle: {
      paddingLeft: `${contentPaddingX}rem`,
      paddingRight: `${contentPaddingX}rem`,
    } as const,
    /** Inline style for full content box padding (all 4 sides) */
    contentPaddingStyle: {
      paddingLeft: `${contentPaddingX}rem`,
      paddingRight: `${contentPaddingX}rem`,
      paddingTop: `${contentPadding}rem`,
      paddingBottom: `${contentPadding}rem`,
    } as const,
  }
}

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
  /** Show an "NPC" section separator above the NPC name/HP block */
  showNpcSeparator?: boolean
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

/** Props accepted by useEntityDisplayState */
export type EntityDisplayStateInput = {
  data: SURefEntity
  schemaName: SURefEnumSchemaName
  compact: boolean
  headerColor?: string
  dimHeader: boolean
  disabled: boolean
  hide?: EntityHideConfig
  listing: boolean
  damaged?: boolean
  label?: string
  classAbilitiesRenderer?: ClassAbilitiesRenderer
  patternOverride?: PatternOverrideData
}

/** Computed state returned by useEntityDisplayState. Extends input with derived values. */
export type EntityDisplayState = Omit<EntityDisplayStateInput, 'headerColor' | 'dimHeader'> & {
  /** hide with all fields resolved to booleans (no undefined) */
  hide: Required<EntityHideConfig>
  /** Resolved to non-optional boolean */
  damaged: boolean
  title: string
  techLevel: number | 'B' | 'N' | undefined
  headerBg: string
  headerBgColor?: string
  spacing: ReturnType<typeof getEntitySpacing>
  fontSize: ReturnType<typeof getEntityFontSizes>
  opacity: { header: number; content: number }
  shouldShowExtraContent: boolean
  chassisAbilities?: SURefMetaAction[]
  effects?: ReturnType<typeof getEffects>
  table?: SURefObjectTable
  assetUrl?: string
  actionsToDisplay?: SURefMetaAction[]
  matchingAction?: SURefMetaAction
  source?: SURefEnumSource
}
