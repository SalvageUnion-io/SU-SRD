import { getActionTypes } from 'salvageunion-reference'
import { cn } from '../../utils/cn'

const ACTION_TYPES = [
  { value: 'all', label: 'All' },
  { value: 'generic', label: 'Generic' },
  ...getActionTypes().map((t) => ({
    value: t.toLowerCase(),
    label: t === 'DownTime' ? 'Downtime' : t,
  })),
] as const

type ActionFilterChipsProps = {
  selected: string
  onChange: (value: string) => void
}

export function ActionFilterChips({ selected, onChange }: ActionFilterChipsProps) {
  return (
    <div
      role="group"
      aria-label="Filter by action type"
      className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none"
    >
      {ACTION_TYPES.map((type) => (
        <button
          key={type.value}
          onClick={() => onChange(type.value)}
          aria-pressed={selected === type.value}
          className={cn(
            'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
            selected === type.value
              ? 'bg-pilot text-white'
              : 'bg-su-grey-light/20 text-su-grey-dark hover:bg-su-grey-light/40'
          )}
        >
          {type.label}
        </button>
      ))}
    </div>
  )
}
