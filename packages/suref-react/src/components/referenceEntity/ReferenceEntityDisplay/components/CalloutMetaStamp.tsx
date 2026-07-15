import type { ReactNode } from 'react'
import { Text } from '../../../base/Text'
import { cn } from '../../../../utils/cn'

/**
 * Pseudoheader stamp for the header label-callout row. A single definition so
 * callout meta stamps share one treatment instead of being hand-rolled inline
 * at the call site. With `rust`, renders the rust-backed variant (e.g.
 * "Recommended"); otherwise the neutral base stamp (e.g. label/labelBadge).
 */
export function CalloutMetaStamp({
  children,
  rust = false,
  compact = false,
  xs = false,
}: {
  children: ReactNode
  rust?: boolean
  compact?: boolean
  /** Extra-small (text-label / 10px) — the seam-tag size; matches StatDisplay xs. */
  xs?: boolean
}) {
  return (
    <Text
      variant="pseudoheader"
      as="span"
      // Mirror the segmented ValueDisplay callout's size + weight exactly so a
      // lone stamp (e.g. legendary / generic ability trees, which have no numeric
      // level badge) is uniform with the segmented callout used for numeric
      // levels / tech levels: xs → text-label (the seam-tag size), compact →
      // text-xs, else text-sm. The pseudoheader variant is font-bold; these override it.
      className={cn(
        'whitespace-nowrap uppercase',
        xs ? 'text-label font-bold' : compact ? 'text-xs font-normal' : 'text-sm font-semibold',
        rust && 'bg-su-rust text-paper'
      )}
    >
      {children}
    </Text>
  )
}
