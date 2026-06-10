import { memo } from 'react'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import { ReferenceEntityDisplayContent } from './components/ReferenceEntityDisplayContent'
import type { ReferenceEntityDisplayContentProps } from './components/ReferenceEntityDisplayContent'
import { resolveDisplayMode } from '../../shared/displayMode'
import type { EntityDisplayMode } from '../../shared/displayMode'
import type { EntityStatus } from '../../chrome/StatusBadge'

/** Fields that ReferenceEntityDisplay overrides from ReferenceEntityDisplayContentProps */
type OverriddenFields =
  | 'data'
  | 'schemaName'
  | 'dimHeader'
  | 'disabled'
  | 'listing'
  | 'compact'
  | 'damaged'
  | 'lightweight'

type ReferenceEntityDisplayProps = Omit<ReferenceEntityDisplayContentProps, OverriddenFields> & {
  data: SURefEntity | undefined
  dimHeader?: boolean
  disabled?: boolean
  listing?: boolean
  compact?: boolean
  /** Display-mode sugar over `compact`/`listing` (design-spec §2.1):
   * full = neither, compact = compact only, head = compact + listing.
   * Explicit booleans take precedence when both are provided. */
  mode?: EntityDisplayMode
  damaged?: boolean
  lightweight?: boolean
}

export const ReferenceEntityDisplay = memo(function ReferenceEntityDisplay({
  data,
  damaged = false,
  dimHeader = false,
  disabled = false,
  listing: listingProp,
  compact: compactProp,
  mode,
  lightweight = false,
  ...rest
}: ReferenceEntityDisplayProps) {
  if (!data) return null

  // Get schemaName from data, with fallback for entities that might not have it yet
  const schemaName = (
    'schemaName' in data && typeof data.schemaName === 'string' ? data.schemaName : undefined
  ) as SURefEnumSchemaName | undefined

  if (!schemaName) {
    console.warn('ReferenceEntityDisplay: data does not have schemaName property', data)
    return null
  }

  const { compact, listing } = resolveDisplayMode(mode, compactProp, listingProp)

  // `status` supersets `damaged` (kept as alias): a damaged/destroyed status
  // applies the same grey-header treatment the boolean always has.
  const status: EntityStatus | undefined = rest.status
  const effectiveDamaged = damaged || status === 'damaged' || status === 'destroyed'

  return (
    <ReferenceEntityDisplayContent
      data={data}
      schemaName={schemaName}
      compact={compact}
      dimHeader={dimHeader}
      disabled={disabled}
      listing={listing}
      damaged={effectiveDamaged}
      lightweight={lightweight}
      {...rest}
    />
  )
})
