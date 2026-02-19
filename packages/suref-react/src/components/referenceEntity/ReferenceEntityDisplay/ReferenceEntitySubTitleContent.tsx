import type { ReactNode } from 'react'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import {
  extractReferenceEntityDetails,
  getActivationCurrency,
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

  const values = extractReferenceEntityDetails(data, schemaName, currency)

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
