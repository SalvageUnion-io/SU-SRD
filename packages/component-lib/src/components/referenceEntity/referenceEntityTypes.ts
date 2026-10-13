import type { SURefObjectPatternSystemModule } from 'salvageunion-reference'
import { space } from '../../design/tokens'

/**
 * Spacing helpers based on compact mode.
 *
 * Returns token VALUES, not class strings: `smallGap` / `sectionGap` are the
 * vertical rhythm of a stacked block (fed to `stackClassName`, or to a flex
 * `gap`).
 */
export const getReferenceEntitySpacing = (compact: boolean) => ({
  /** Gap between small elements: 6px (compact) or 8px (normal) */
  smallGap: compact ? space[6] : space[8],
  /** Gap between sections: 12px (compact) or 16px (normal) */
  sectionGap: compact ? space[12] : space[16],
})

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

/**
 * Font size helpers based on compact mode.
 * Returns `fontSize` token KEYS (`'xs'` is `fontSize.xs`); `sm` is a valid
 * `ContentFontSize` as it stands.
 */
export const getReferenceEntityFontSizes = (compact: boolean): { sm: 'xs' | 'sm' } => ({
  /** Small text */
  sm: compact ? 'xs' : 'sm',
})

/** Pattern override data for patterned chassis display */
export type PatternOverrideData = {
  name: string
  systems: SURefObjectPatternSystemModule[]
  modules: SURefObjectPatternSystemModule[]
}
