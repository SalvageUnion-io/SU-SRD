import { memo } from 'react'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import { EntityDisplayContent } from './components/EntityDisplayContent'
import type { EntityDisplayContentProps } from './components/EntityDisplayContent'

/** Fields that EntityDisplay overrides from EntityDisplayContentProps */
type OverriddenFields =
  | 'data'
  | 'schemaName'
  | 'dimHeader'
  | 'disabled'
  | 'listing'
  | 'compact'
  | 'damaged'
  | 'lightweight'

type EntityDisplayProps = Omit<EntityDisplayContentProps, OverriddenFields> & {
  data: SURefEntity | undefined
  dimHeader?: boolean
  disabled?: boolean
  listing?: boolean
  compact?: boolean
  damaged?: boolean
  lightweight?: boolean
}

export const EntityDisplay = memo(function EntityDisplay({
  data,
  damaged = false,
  dimHeader = false,
  disabled = false,
  listing = false,
  compact = false,
  lightweight = false,
  ...rest
}: EntityDisplayProps) {
  if (!data) return null

  // Get schemaName from data, with fallback for entities that might not have it yet
  const schemaName = (
    'schemaName' in data && typeof data.schemaName === 'string' ? data.schemaName : undefined
  ) as SURefEnumSchemaName | undefined

  if (!schemaName) {
    console.warn('EntityDisplay: data does not have schemaName property', data)
    return null
  }

  return (
    <EntityDisplayContent
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
