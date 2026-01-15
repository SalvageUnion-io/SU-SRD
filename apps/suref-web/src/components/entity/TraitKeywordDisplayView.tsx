import {
  SalvageUnionReference,
  EntitySchemaNames,
  type SURefEnumSchemaName,
  type EntitySchemaName,
} from 'salvageunion-reference'
import { EntityDisplayTooltip } from './EntityDisplayTooltip'
import { ValueDisplay } from '../shared/ValueDisplay'
import { useMemo } from 'react'
import { getTiltRotation } from '../../utils/tiltUtils'

/**
 * View-only component for displaying trait or keyword details
 * Accepts damaged state as a prop instead of reading from context
 */
export function TraitKeywordDisplayView({
  label,
  value,
  schemaName,
  compact = false,
  inline = true,
  damaged = false,
}: {
  value?: number | string
  label: number | string
  compact?: boolean
  schemaName: SURefEnumSchemaName
  /** Whether to display inline (default: true). Set to false for flex container contexts. */
  inline?: boolean
  /** Whether the entity is damaged (affects visual styling) */
  damaged?: boolean
}) {
  const valueRotation = useMemo(() => (damaged ? getTiltRotation() : 0), [damaged])

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
    return (
      <ValueDisplay
        label={label}
        value={value}
        compact={compact}
        inline={inline}
        damaged={damaged}
        rotation={valueRotation}
      />
    )
  }

  return (
    <EntityDisplayTooltip schemaName={schemaName} entityId={id} openDelay={300}>
      <ValueDisplay
        label={label}
        value={value}
        compact={compact}
        inline={inline}
        damaged={damaged}
        rotation={valueRotation}
      />
    </EntityDisplayTooltip>
  )
}
