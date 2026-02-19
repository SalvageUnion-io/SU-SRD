import { SalvageUnionReference, EntitySchemaNames } from 'salvageunion-reference'
import type { SURefEnumSchemaName, EntitySchemaName } from 'salvageunion-reference'
import { ReferenceEntityDisplayTooltip } from './ReferenceEntityDisplayTooltip'
import { ValueDisplay } from '../shared/ValueDisplay'
import { useMemo } from 'react'

/**
 * View-only component for displaying trait or keyword details
 */
export function TraitKeywordDisplayView({
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
  const entity = useMemo(() => {
    // Only search in entity schemas (not meta schemas)
    if (EntitySchemaNames.has(schemaName as EntitySchemaName)) {
      return SalvageUnionReference.findIn(
        schemaName as EntitySchemaName,
        (t) => t.name.toLowerCase() === String(label).toLowerCase()
      )
    }
    return undefined
  }, [schemaName, label])
  const id = entity?.id

  if (!id) {
    return <ValueDisplay label={label} value={value} compact={compact} inline={inline} />
  }

  return (
    <ReferenceEntityDisplayTooltip schemaName={schemaName} entityId={id} openDelay={300}>
      <ValueDisplay label={label} value={value} compact={compact} inline={inline} />
    </ReferenceEntityDisplayTooltip>
  )
}
