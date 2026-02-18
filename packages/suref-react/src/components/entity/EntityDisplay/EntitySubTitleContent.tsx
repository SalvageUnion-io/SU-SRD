import type { ReactNode } from 'react'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import { extractEntityDetails, getActivationCurrency } from '../../../lib/entityDataExtraction'
import { DataValueDisplayView } from '../DataValueDisplayView'
import { cn } from '../../../utils/cn'
import type { getEntitySpacing } from './entityDisplayTypes'

type EntitySubTitleElementProps = {
  data: SURefEntity
  schemaName: SURefEnumSchemaName
  spacing: ReturnType<typeof getEntitySpacing>
  compact: boolean
  /** Extra content appended after standard subtitle values */
  subtitleExtra?: ReactNode
}

export function EntitySubTitleElement({
  data,
  schemaName,
  spacing,
  compact,
  subtitleExtra,
}: EntitySubTitleElementProps) {
  // Determine currency for activation cost
  const variableCost = 'activationCurrency' in data && schemaName === 'abilities'
  const currency = getActivationCurrency(schemaName, variableCost)

  const values = extractEntityDetails(data, schemaName, currency)

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
