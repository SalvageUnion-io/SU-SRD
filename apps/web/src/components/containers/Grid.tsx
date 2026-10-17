import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../../lib/cn'
import type { CSSVarStyle } from '../../styles/cssVars'
import type { LayoutGap } from './layoutGap'

export type GridProps = ComponentPropsWithoutRef<'div'> & {
  /**
   * The narrowest a column may get (`'26rem'`): as many columns as fit, one
   * on a screen narrower than this, which `min(100%, …)` keeps from
   * scrolling sideways.
   */
  min: string
  /** The space between cells, across and down: a step of `tokens.space`. */
  gap: LayoutGap
}

/**
 * GRID — as many equal columns as fit at `min` wide, without a media query
 * (`.su-grid`, `styles/partials/foundation.css`; the measure is `--su-grid-min`).
 * Anything else (an alignment, a measure of its own) rides `style`.
 */
export function Grid({ min, gap, className, style, ...rest }: GridProps) {
  const vars: CSSVarStyle = { '--su-grid-min': min, ...style }
  return <div {...rest} className={cn('su-grid', className)} data-gap={gap} style={vars} />
}
