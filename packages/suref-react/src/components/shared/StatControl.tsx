import { StatDisplay } from './StatDisplay'

type StatControlProps = {
  label: string
  value: number
  max?: number
  bottomLabel?: string
  canEdit: boolean
  compact?: boolean
  onChange: (newValue: number) => void
}

export function StatControl({
  label,
  value,
  max,
  bottomLabel,
  canEdit,
  compact = false,
  onChange,
}: StatControlProps) {
  const atMin = value <= 0
  const atMax = max !== undefined && value >= max

  const btnSize = compact ? 'h-3 w-3 text-[9px]' : 'h-4 w-4 text-xs'

  return (
    <div className="flex items-center gap-0.5">
      <StatDisplay
        label={label}
        value={value}
        outOfMax={max}
        bottomLabel={bottomLabel}
        compact={compact}
      />
      {canEdit && (
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
            disabled={!!atMax}
            className={`flex items-center justify-center border border-su-black bg-su-white font-mono font-bold leading-none text-su-black transition-colors ${btnSize} ${
              atMax
                ? 'cursor-not-allowed opacity-30'
                : 'cursor-pointer hover:bg-su-black hover:text-su-white'
            }`}
          >
            +
          </button>
          <button
            type="button"
            onClick={() => onChange(Math.max(0, value - 1))}
            disabled={atMin}
            className={`flex items-center justify-center border border-su-black bg-su-white font-mono font-bold leading-none text-su-black transition-colors ${btnSize} ${
              atMin
                ? 'cursor-not-allowed opacity-30'
                : 'cursor-pointer hover:bg-su-black hover:text-su-white'
            }`}
          >
            −
          </button>
        </div>
      )}
    </div>
  )
}
