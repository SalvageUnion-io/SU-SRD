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
}: {
  children: ReactNode
  rust?: boolean
}) {
  return (
    <Text
      variant="pseudoheader"
      as="span"
      // font-semibold overrides the pseudoheader variant's font-bold so a lone
      // stamp (e.g. legendary/generic ability trees, which have no numeric badge)
      // matches the weight of the segmented ValueDisplay callout used for numeric
      // levels / tech levels.
      className={cn(
        'whitespace-nowrap text-xs font-semibold uppercase',
        rust && 'bg-su-rust text-su-white'
      )}
    >
      {children}
    </Text>
  )
}
