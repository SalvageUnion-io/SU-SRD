import type { ReactNode } from 'react'
import type {
  SURefClass,
  SURefEntity,
  SURefEnumSchemaName,
  SURefEnumSource,
  SURefMetaAction,
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
 * Button props type for ShadCN version (replaces Chakra ButtonProps)
 */
export type EntityButtonConfig = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  className?: string
}

export type EntityImageComponentProps = {
  src: string
  alt: string
  className?: string
  style?: React.CSSProperties
  loading?: 'lazy' | 'eager'
  decoding?: 'async' | 'auto' | 'sync'
  onLoad?: () => void
  onError?: () => void
}

export type EntityImageComponent = React.ComponentType<EntityImageComponentProps>

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
  /** Spacing values */
  spacing: ReturnType<typeof getEntitySpacing>
  /** Font size values */
  fontSize: ReturnType<typeof getEntityFontSizes>
  /** Content background color */
  contentBg: string
  /** Computed opacity values */
  opacity: { header: number; content: number }
  /** Whether to show extra content sections */
  shouldShowExtraContent: boolean
  /** Header click handler (undefined when no onClick is provided) */
  handleHeaderClick: (() => void) | undefined
  /** Whether the component is expanded */
  isExpanded: boolean
  /** Whether the component is collapsible */
  collapsible: boolean
  /** Whether to hide actions */
  hideActions: boolean
  /** Whether to hide chassis patterns */
  hidePatterns: boolean
  /** Whether to hide choices */
  hideChoices: boolean
  /** Whether to hide tech level */
  hideLevel: boolean
  /** Custom right content for header */
  rightContent?: ReactNode
  /** Whether the entity is damaged */
  damaged: boolean
  /** Whether the component is disabled */
  disabled: boolean
  /** Button configuration */
  buttonConfig?: EntityButtonConfig
  /** User choices for entity options */
  userChoices?: Record<string, string> | null
  /** Custom width for the image (e.g., '40%') */
  imageWidth?: string
  /** Computed entity display name */
  entityName: string
  /** Whether entity has actions */
  hasActions: boolean
  /** Array of chassis abilities (or undefined) */
  chassisAbilities?: SURefMetaAction[]
  /** Array of effects (or undefined) */
  effects?: ReturnType<typeof getEffects>
  /** Table data (or undefined) */
  table?: SURefObjectTable
  /** Asset URL string (or undefined) */
  assetUrl?: string
  /** Array of visible actions (or undefined) */
  visibleActions?: SURefMetaAction[]
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
  /** Optional custom image component (defaults to native img) */
  imageComponent?: EntityImageComponent
}
