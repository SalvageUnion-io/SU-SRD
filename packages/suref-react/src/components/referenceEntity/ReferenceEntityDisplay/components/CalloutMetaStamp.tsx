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
      className={cn('whitespace-nowrap text-xs uppercase', rust && 'bg-su-rust text-su-white')}
    >
      {children}
    </Text>
  )
}
