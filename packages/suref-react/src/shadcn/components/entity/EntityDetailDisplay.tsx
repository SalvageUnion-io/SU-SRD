import type { SURefEnumSchemaName } from 'salvageunion-reference'
import { useEntityDisplayContext } from './EntityDisplay/useEntityDisplayContext'
import { TraitKeywordDisplayView } from './TraitKeywordDisplayView'

export function EntityDetailDisplay({
  label,
  value,
  schemaName,
  compact = false,
  inline = true,
}: {
  value?: number | string
  label: number | string
  compact?: boolean
  schemaName: SURefEnumSchemaName
  /** Whether to display inline (default: true). Set to false for flex container contexts. */
  inline?: boolean
}) {
  const { damaged } = useEntityDisplayContext()

  return (
    <TraitKeywordDisplayView
      label={label}
      value={value}
      schemaName={schemaName}
      compact={compact}
      inline={inline}
      damaged={damaged}
    />
  )
}
