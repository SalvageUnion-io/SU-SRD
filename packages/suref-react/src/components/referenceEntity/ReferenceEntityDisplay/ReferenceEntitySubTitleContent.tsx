import type { ReactNode } from 'react'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import {
  extractReferenceEntityDetails,
  getActivationCurrency,
  CALLOUT_META_LABEL_VALUES,
} from '../../../lib/referenceEntityDataExtraction'
import { DataValueDisplayView } from '../DataValueDisplayView'
import { cn } from '../../../utils/cn'
import type { getReferenceEntitySpacing } from './referenceEntityDisplayTypes'

type ReferenceEntitySubTitleElementProps = {
  data: SURefEntity
  schemaName: SURefEnumSchemaName
  spacing: ReturnType<typeof getReferenceEntitySpacing>
  compact: boolean
  /** Extra content appended after standard subtitle values */
  subtitleExtra?: ReactNode
}

export function ReferenceEntitySubTitleElement({
  data,
  schemaName,
  spacing,
  compact,
  subtitleExtra,
}: ReferenceEntitySubTitleElementProps) {
  // Determine currency for activation cost
  const variableCost = 'activationCurrency' in data && schemaName === 'abilities'
  const currency = getActivationCurrency(schemaName, variableCost)

  const values = extractReferenceEntityDetails(data, schemaName, currency).filter(
    // "Recommended" and the class type ("Base/Hybrid Class") now render in the
    // header label callout row, not the data row. Filter by the shared constant
    // (CALLOUT_META_LABELS) so the producer and this de-dup can't drift apart.
    (v) =>
      !(
        v.type === 'meta' &&
        typeof v.label === 'string' &&
        CALLOUT_META_LABEL_VALUES.includes(v.label)
      )
  )

  if (values.length === 0 && !subtitleExtra) return null

  return (
    <div
      className={cn(
        'flex flex-wrap items-center',
        spacing.minimalGap <= 0.25 ? 'gap-0.5' : 'gap-1'
      )}
    >
      {values.map((item, index) => (
        <DataValueDisplayView key={index} item={item} compact={compact} />
      ))}
      {subtitleExtra}
    </div>
  )
}
