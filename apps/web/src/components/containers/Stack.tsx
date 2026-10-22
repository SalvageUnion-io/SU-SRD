import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../../lib/cn'
import type { LayoutGap } from './layoutGap'

export type StackProps = ComponentPropsWithoutRef<'div'> & {
  /** The space between children: a step of `tokens.space` (`16` is 16px). */
  gap: LayoutGap
  /** The element: a `section` when the stack is a labelled region. */
  as?: 'div' | 'section'
}

/**
 * STACK — children in a column, a space step apart. A class, not a style
 * object (`.su-stack`, `styles/partials/foundation.css`), because the reference site writes a
 * style object out on every element that wears it; the gap is `data-gap`.
 * Anything else the element needs (padding, a min width) rides `style`.
 */
export function Stack({ gap, as: Element = 'div', className, ...rest }: StackProps) {
  return <Element {...rest} className={cn('su-stack', className)} data-gap={gap} />
}
