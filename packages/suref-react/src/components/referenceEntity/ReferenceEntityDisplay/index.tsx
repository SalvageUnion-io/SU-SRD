import { memo } from 'react'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import { ReferenceEntityDisplayContent } from './components/ReferenceEntityDisplayContent'
import type { ReferenceEntityDisplayContentProps } from './components/ReferenceEntityDisplayContent'

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
  damaged?: boolean
  lightweight?: boolean
}

export const ReferenceEntityDisplay = memo(function ReferenceEntityDisplay({
  data,
  damaged = false,
  dimHeader = false,
  disabled = false,
  listing = false,
  compact = false,
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

  return (
    <ReferenceEntityDisplayContent
      data={data}
      schemaName={schemaName}
      compact={compact}
      dimHeader={dimHeader}
      disabled={disabled}
      listing={listing}
      damaged={damaged}
      lightweight={lightweight}
      {...rest}
    />
  )
})
