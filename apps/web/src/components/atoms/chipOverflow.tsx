import type { CSSProperties } from 'react'
import { cn } from '../../lib/cn'
import type { Size } from '../../styles/sizing'
import { Stat } from './Stat'

/**
 * A contentful head's overflow row (`chips-and-actions.md` C2b): its body's
 * first row, right under the head, holding what of the head's chips did not
 * fit beside the name (`chipFill.ts` lays copies of them here, left-aligned,
 * in class order). Hidden while every chip fits. Drawn empty: React never
 * writes its children.
 */
export function ChipOverflowRow({
  className,
  style,
}: {
  className?: string
  /** Its host's measure (a Page band's), so it lines up with what it heads. */
  style?: CSSProperties | undefined
}) {
  return (
    <div
      className={cn('su-chips su-chip-overflow', className)}
      style={style}
      data-chip-overflow=""
      hidden
    />
  )
}

/**
 * A header-only head's +MORE (C5): its strip's last chip, drawn once a chip
 * did not fit beside the name (`chipFill.ts`), the cost right before it. A
 * chip, not a control: the head itself opens its entity, where the rest is.
 */
export function MoreChip({ size = 'compact' }: { size?: Size }) {
  return (
    <span className="su-chip-more" data-chip-more="" hidden>
      <Stat label="+MORE" size={size} />
    </span>
  )
}
