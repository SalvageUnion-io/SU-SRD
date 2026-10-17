import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../../lib/cn'
import type { LayoutGap } from './layoutGap'

export type ClusterProps = ComponentPropsWithoutRef<'div'> & {
  /** The space between children, across and down: a step of `tokens.space`. */
  gap: LayoutGap
}

/**
 * CLUSTER — children in a row that wraps, centred on the cross axis, a space
 * step apart: a line of buttons, chips or stamps (`.su-cluster`,
 * `styles/partials/layout.css`). Anything else rides `style`.
 */
export function Cluster({ gap, className, ...rest }: ClusterProps) {
  return <div {...rest} className={cn('su-cluster', className)} data-gap={gap} />
}
