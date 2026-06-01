import type { ReactNode } from 'react'
import { Text } from '../../../base/Text'

/**
 * Rust-backed pseudoheader stamp for the header label-callout row (e.g.
 * "Recommended"). A single definition so callout meta stamps share one rust
 * treatment instead of being hand-rolled inline at the call site.
 */
export function CalloutMetaStamp({ children }: { children: ReactNode }) {
  return (
    <Text
      variant="pseudoheader"
      as="span"
      className="whitespace-nowrap bg-su-rust text-xs uppercase text-su-white"
    >
      {children}
    </Text>
  )
}
