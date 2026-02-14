import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import { extractEntityDetails, getActivationCurrency } from '../../../lib/entityDataExtraction'
import { SharedDetailItem } from './sharedDetailItem'
import { cn } from '../../../utils/cn'
import type { getEntitySpacing } from './entityDisplayTypes'

type EntitySubTitleElementProps = {
  data: SURefEntity
  schemaName: SURefEnumSchemaName
  spacing: ReturnType<typeof getEntitySpacing>
  compact: boolean
  damaged: boolean
  /** When set, prepends a "<entity.name> Chassis" tag to the subtitle */
  hasPatternOverride?: boolean
}

export function EntitySubTitleElement({
  data,
  schemaName,
  spacing,
  compact,
  damaged,
  hasPatternOverride,
}: EntitySubTitleElementProps) {
  // Determine currency for activation cost
  const variableCost = 'activationCurrency' in data && schemaName === 'abilities'
  const currency = getActivationCurrency(schemaName, variableCost)

  const values = extractEntityDetails(data, schemaName, currency)

  // In patterned mode, prepend a "Chassis Name Chassis" tag
  if (hasPatternOverride && 'name' in data && typeof data.name === 'string') {
    values.unshift({ label: `${data.name} Chassis`, type: 'meta' })
  }

  if (values.length === 0) return null

  return (
    <div
      className={cn(
        'flex flex-wrap items-center',
        spacing.minimalGap <= 0.25 ? 'gap-0.5' : 'gap-1'
      )}
    >
      {values.map((item, index) => (
        <SharedDetailItem key={index} item={item} compact={compact} damaged={damaged} />
      ))}
    </div>
  )
}
