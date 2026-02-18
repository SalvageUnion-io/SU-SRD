import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import type { EntityControl } from '../entityControlTypes'
import { EntityDisplayContent } from './EntityDisplayContent'

/**
 * Wrapper for guide step entity listings rendered as compact inline cards.
 * Needed because the renderEntityListing callback can't call hooks directly.
 */
export function GuideEntityListing({
  data,
  schemaName,
  compact,
  listing,
  disabled,
  controls,
}: {
  data: SURefEntity
  schemaName: SURefEnumSchemaName
  compact: boolean
  listing: boolean
  disabled: boolean
  controls?: EntityControl[]
}) {
  return (
    <EntityDisplayContent
      data={data}
      schemaName={schemaName}
      compact={compact}
      listing={listing}
      dimHeader={false}
      disabled={disabled}
      hide={{ actions: listing, patterns: true, choices: true }}
      controls={controls}
    />
  )
}
