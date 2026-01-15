import { createContext } from 'react'
import type { ReactNode } from 'react'
import type { ButtonProps } from '@chakra-ui/react'
import type {
  SURefEntity,
  SURefEnumSchemaName,
  SURefEnumSource,
  SURefMetaAction,
  SURefObjectTable,
} from 'salvageunion-reference'
// Import functions for type extraction (typeof requires actual values, not types)
import type { getEffects } from 'salvageunion-reference'

/**
 * Spacing helpers based on compact mode
 */
export const getEntitySpacing = (compact: boolean) => ({
  /** Gap between small elements: 2 (compact) or 3 (normal) */
  smallGap: compact ? 2 : 3,
  /** Gap for minimal spacing: 0.5 (compact) or 1 (normal) */
  minimalGap: compact ? 0.5 : 1,
  /** Gap for single spacing: 0.5 (compact) or 1 (normal) */
  contentPadding: compact ? 0.5 : 1,
})

/**
 * Font size helpers based on compact mode
 */
export const getEntityFontSizes = (compact: boolean) => ({
  /** Extra small text */
  xs: compact ? '2xs' : 'xs',
  /** Small text */
  sm: compact ? 'xs' : 'sm',
  /** Medium text */
  md: compact ? 'sm' : 'md',
  /** Large text */
  lg: compact ? 'md' : 'lg',
})

export interface EntityDisplayContextValue {
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
  /** Header click handler */
  handleHeaderClick: () => void
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
  /** Whether to show the footer (page reference). Defaults to !hideActions */
  showFooter?: boolean
  /** Whether to hide tech level */
  hideLevel: boolean
  /** Custom right content for header */
  rightContent?: ReactNode
  /** Whether the entity is damaged */
  damaged: boolean
  /** Whether the component is disabled */
  disabled: boolean
  /** Button configuration */
  buttonConfig?: ButtonProps & { children: ReactNode }
  /** User choices for entity options */
  userChoices?: Record<string, string> | null
  /** Children to render in the content area */
  children?: ReactNode
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
}

export const EntityDisplayContext = createContext<EntityDisplayContextValue | null>(null)
