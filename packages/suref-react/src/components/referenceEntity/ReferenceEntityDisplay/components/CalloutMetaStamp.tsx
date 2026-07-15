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
}: {
  children: ReactNode
  rust?: boolean
  compact?: boolean
}) {
  return (
    <Text
      variant="pseudoheader"
      as="span"
      // Mirror ValueDisplay's size + weight exactly (text-sm/font-semibold in full
      // mode, text-xs/font-normal when compact) so a lone stamp — e.g. legendary
      // and generic ability trees, which have no numeric level badge — is uniform
      // with the segmented ValueDisplay callout used for numeric levels / tech
      // levels. The pseudoheader variant is font-bold; these override it.
      className={cn(
        'whitespace-nowrap uppercase',
        compact ? 'text-xs font-normal' : 'text-sm font-semibold',
        rust && 'bg-su-rust text-paper'
      )}
    >
      {children}
    </Text>
  )
}
