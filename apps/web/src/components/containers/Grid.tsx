import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../../lib/cn'
import type { CSSVarStyle } from '../../styles/cssVars'
import type { LayoutGap } from './layoutGap'

export type GridProps = ComponentPropsWithoutRef<'div'> & {
  /**
   * The narrowest an item may get (`'26rem'`): as many a row as fit, one on a
   * screen narrower than this.
   */
  min: string
  /** The most items a row holds; as many as fit when absent. */
  max?: number
  /** The space between items, across and down: a step of `tokens.space`. */
  gap: LayoutGap
}

/**
 * GRID: the one item grid (hard rule R68, `.su-grid`,
 * `styles/partials/foundation.css`). Its items wrap at `min` wide and grow to
 * share their row, so a short last row fills the line: no empty track, no
 * orphan cell, no media query. Anything else (an alignment) rides `style`.
 */
export function Grid({ min, max, gap, className, style, ...rest }: GridProps) {
  const vars: CSSVarStyle = { '--su-grid-min': min, '--su-grid-max': max, ...style }
  return <div {...rest} className={cn('su-grid', className)} data-gap={gap} style={vars} />
}
