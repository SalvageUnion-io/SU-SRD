import { cn } from '../../utils/cn'
import type { ItemCondition } from '../../../shared/types/common'

type ConditionControlProps = {
  condition: ItemCondition
  onChange: (condition: ItemCondition) => void
  compact?: boolean
}

const conditions: Array<{ value: ItemCondition; label: string; dotClass: string }> = [
  { value: 'intact', label: 'Intact', dotClass: 'bg-intact' },
  { value: 'damaged', label: 'Damaged', dotClass: 'bg-damaged' },
  { value: 'destroyed', label: 'Destroyed', dotClass: 'bg-destroyed' },
]

export function ConditionControl({ condition, onChange, compact = false }: ConditionControlProps) {
  if (compact) {
    const current = conditions.find((c) => c.value === condition)!
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          const idx = conditions.findIndex((c) => c.value === condition)
          onChange(conditions[(idx + 1) % conditions.length]!.value)
        }}
        className={cn('h-3 w-3 rounded-full', current.dotClass)}
        title={current.label}
        aria-label={`Condition: ${current.label}`}
      />
    )
  }

  return (
    <div className="flex rounded-lg border border-[var(--border)] p-0.5">
      {conditions.map((c) => (
        <button
          key={c.value}
          onClick={() => onChange(c.value)}
          className={cn(
            'flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
            condition === c.value ? 'bg-su-grey-light/30 font-medium' : 'hover:bg-su-grey-light/10'
          )}
        >
          <span className={cn('h-2 w-2 rounded-full', c.dotClass)} />
          {c.label}
        </button>
      ))}
    </div>
  )
}
