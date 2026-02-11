import { useEntityDisplayContext } from './useEntityDisplayContext'
import { cn } from '../../../utils/cn'

/**
 * Displays population range for crawler-tech-levels schema
 */
export function EntityPopulationRange() {
  const { data, schemaName, spacing } = useEntityDisplayContext()

  if (schemaName !== 'crawler-tech-levels') return null

  if (
    !('populationMin' in data) ||
    !('populationMax' in data) ||
    typeof data.populationMin !== 'number' ||
    typeof data.populationMax !== 'number'
  ) {
    return null
  }

  return (
    <div
      className={cn('rounded-md border-2 border-su-black bg-su-white')}
      style={{ padding: `${spacing.smallGap}rem` }}
    >
      <p className="text-su-black">
        <span className="font-bold text-brand-srd">Population Range: </span>
        {data.populationMin.toLocaleString()} - {data.populationMax.toLocaleString()}
      </p>
    </div>
  )
}
