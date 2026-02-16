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
  /** When true, appends a "Legal Starting Mech" tag */
  isLegalStartingMech?: boolean
}

export function EntitySubTitleElement({
  data,
  schemaName,
  spacing,
  compact,
  damaged,
  hasPatternOverride,
  isLegalStartingMech,
}: EntitySubTitleElementProps) {
  // Determine currency for activation cost
  const variableCost = 'activationCurrency' in data && schemaName === 'abilities'
  const currency = getActivationCurrency(schemaName, variableCost)

  const values = extractEntityDetails(data, schemaName, currency)

  // Prepend "Legal Starting Mech" tag first when pattern qualifies
  if (isLegalStartingMech) {
    values.unshift({ label: 'Legal Starting Mech', type: 'meta' })
  }

  // In patterned mode, prepend a "Chassis Name Chassis" tag (after Legal Starting Mech)
  if (hasPatternOverride && 'name' in data && typeof data.name === 'string') {
    const insertIndex = isLegalStartingMech ? 1 : 0
    values.splice(insertIndex, 0, { label: `${data.name} Chassis`, type: 'meta' })
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
