import { StatDisplay } from './StatDisplay'

type StatControlProps = {
  label: string
  value: number
  min?: number
  max?: number
  bottomLabel?: string
  canEdit: boolean
  compact?: boolean
  inverse?: boolean
  bg?: string
  valueColor?: string
  borderColor?: string
  onChange: (newValue: number) => void
}

export function StatControl({
  label,
  value,
  min = 0,
  max,
  bottomLabel,
  canEdit,
  compact = false,
  inverse = false,
  bg,
  valueColor,
  borderColor,
  onChange,
}: StatControlProps) {
  const atMin = value <= min
  const atMax = max !== undefined && value >= max

  const btnSize = compact ? 'h-3 w-3 text-[9px]' : 'h-4 w-4 text-xs'

  const btnResting = inverse
    ? 'border-su-white bg-su-black text-su-white'
    : 'border-su-black bg-su-white text-su-black'
  const btnHover = inverse
    ? 'hover:bg-su-white hover:text-su-black'
    : 'hover:bg-su-black hover:text-su-white'

  return (
    <div className="flex items-center gap-0.5">
      <StatDisplay
        label={label}
        value={value}
        outOfMax={max}
        bottomLabel={bottomLabel}
        compact={compact}
        inverse={inverse}
        bg={bg}
        valueColor={valueColor}
        borderColor={borderColor}
      />
      {canEdit && (
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            aria-label={`Increase ${label}`}
            onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
            disabled={!!atMax}
            className={`flex min-h-11 min-w-11 items-center justify-center border font-mono font-bold leading-none transition-colors sm:min-h-0 sm:min-w-0 ${btnSize} ${btnResting} ${
              atMax ? 'cursor-not-allowed opacity-30' : `cursor-pointer ${btnHover}`
            }`}
          >
            +
          </button>
          <button
            type="button"
            aria-label={`Decrease ${label}`}
            onClick={() => onChange(Math.max(min, value - 1))}
            disabled={atMin}
            className={`flex min-h-11 min-w-11 items-center justify-center border font-mono font-bold leading-none transition-colors sm:min-h-0 sm:min-w-0 ${btnSize} ${btnResting} ${
              atMin ? 'cursor-not-allowed opacity-30' : `cursor-pointer ${btnHover}`
            }`}
          >
            −
          </button>
        </div>
      )}
    </div>
  )
}
