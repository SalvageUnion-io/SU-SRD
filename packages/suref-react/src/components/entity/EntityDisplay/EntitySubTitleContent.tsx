import { extractEntityDetails, getActivationCurrency } from '../../../lib/entityDataExtraction'
import { useEntityDisplayContext } from './useEntityDisplayContext'
import { SharedDetailItem } from './sharedDetailItem'
import { cn } from '../../../utils/cn'

export function EntitySubTitleElement() {
  const { data, schemaName, spacing, compact } = useEntityDisplayContext()

  // Determine currency for activation cost
  const variableCost = 'activationCurrency' in data && schemaName === 'abilities'
  const currency = getActivationCurrency(schemaName, variableCost)

  const values = extractEntityDetails(data, schemaName, currency)
  if (values.length === 0) return null

  return (
    <div
      className={cn(
        'flex flex-wrap items-center',
        spacing.minimalGap <= 0.25 ? 'gap-0.5' : 'gap-1'
      )}
    >
      {values.map((item, index) => (
        <SharedDetailItem key={index} item={item} compact={compact} />
      ))}
    </div>
  )
}
