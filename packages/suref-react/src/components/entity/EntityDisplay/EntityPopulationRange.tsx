import { cn } from '../../../utils/cn'
import type { getEntitySpacing } from './entityDisplayTypes'

type EntityPopulationRangeProps = {
  populationMin: number
  populationMax: number
  spacing: ReturnType<typeof getEntitySpacing>
}

/**
 * Displays population range for crawler-tech-levels schema
 */
export function EntityPopulationRange({
  populationMin,
  populationMax,
  spacing,
}: EntityPopulationRangeProps) {
  return (
    <div
      className={cn('rounded-md border-2 border-su-black bg-su-white')}
      style={{ padding: `${spacing.smallGap}rem` }}
    >
      <p className="text-su-black">
        <span className="font-bold text-brand-srd">Population Range: </span>
        {populationMin.toLocaleString()} - {populationMax.toLocaleString()}
      </p>
    </div>
  )
}
