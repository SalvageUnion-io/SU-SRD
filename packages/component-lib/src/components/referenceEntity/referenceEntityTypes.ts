import type { SURefObjectPatternSystemModule } from 'salvageunion-reference'
import type { fontSize } from '../../design/tokens'
import { space } from '../../design/tokens'

/**
 * Spacing helpers based on compact mode.
 *
 * Returns token VALUES, not class strings: `smallGap` / `sectionGap` are the
 * vertical rhythm of a stacked block (fed to `stackClassName`, or to a flex
 * `gap`).
 */
export const getReferenceEntitySpacing = (compact: boolean) => {
  const contentPadding = compact ? 0.5 : 0.75
  // Tighter horizontal body padding (closer to the design's ~13px) so the text
  // content stretches further toward the white body-box edges.
  const contentPaddingX = compact ? 0.7 : 0.9

  return {
    /** Gap between small elements: 6px (compact) or 8px (normal) */
    smallGap: compact ? space[6] : space[8],
    /** Gap between sections: 12px (compact) or 16px (normal) */
    sectionGap: compact ? space[12] : space[16],
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

/** A vertical rhythm `getReferenceEntitySpacing` hands out. */
type StackGap = (typeof space)[6 | 8 | 12 | 16]

const STACK_MODIFIER: Record<StackGap, string> = {
  [space[6]]: 'su-pattern-stack--6',
  [space[8]]: 'su-pattern-stack--8',
  [space[12]]: 'su-pattern-stack--12',
  [space[16]]: 'su-pattern-stack--16',
}

/**
 * The classes that stack a block's children at `gap` — the `space-y-*` they
 * replace. A modifier class per rung rather than a custom property: stacks
 * nest, and an inherited property would hand an inner stack's gap to its own
 * margin inside the outer one.
 */
export const stackClassName = (gap: StackGap) => `su-pattern-stack ${STACK_MODIFIER[gap]}`

type TypeRung = keyof typeof fontSize

/**
 * Font size helpers based on compact mode.
 * Returns `fontSize` token KEYS (`'xs'` is `fontSize.xs`); `sm` is a valid
 * `ContentFontSize` as it stands.
 */
export const getReferenceEntityFontSizes = (
  compact: boolean
): { xs: TypeRung; sm: 'xs' | 'sm'; md: TypeRung; lg: TypeRung } => ({
  /** Extra small text */
  xs: compact ? 'badge' : 'xs',
  /** Small text */
  sm: compact ? 'xs' : 'sm',
  /** Medium text */
  md: compact ? 'sm' : 'base',
  /** Large text */
  lg: compact ? 'base' : 'lg',
})

/** Pattern override data for patterned chassis display */
export type PatternOverrideData = {
  name: string
  systems: SURefObjectPatternSystemModule[]
  modules: SURefObjectPatternSystemModule[]
}
