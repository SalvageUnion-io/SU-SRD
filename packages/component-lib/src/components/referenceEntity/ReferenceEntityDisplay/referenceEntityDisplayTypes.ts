import type { SURefObjectPatternSystemModule } from 'salvageunion-reference'

/**
 * Spacing helpers based on compact mode.
 * Returns Tailwind-friendly class strings instead of numeric Chakra spacing.
 */
export const getReferenceEntitySpacing = (compact: boolean) => {
  const contentPadding = compact ? 0.5 : 0.75
  // Tighter horizontal body padding (closer to the design's ~13px) so the text
  // content stretches further toward the white body-box edges.
  const contentPaddingX = compact ? 0.7 : 0.9

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
export const getReferenceEntityFontSizes = (compact: boolean) => ({
  /** Extra small text */
  xs: compact ? 'text-label' : 'text-xs',
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
