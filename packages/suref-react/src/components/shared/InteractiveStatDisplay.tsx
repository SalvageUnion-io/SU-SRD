import { cn } from '../../utils/cn'
import { Text } from '../base/Text'

type InteractiveStatDisplayProps = {
  /** Display label (e.g., "HP", "SP", "Heat") */
  label: string
  /** Current value */
  value: number
  /** Maximum value (for display and upper bound) */
  max: number
  /** Minimum value (default: 0) */
  min?: number
  /** Callback when value changes — when absent, renders read-only (no buttons) */
  onChange?: (newValue: number) => void
  /** Color treatment for the stat (Tailwind bg class, e.g., "bg-su-blue") */
  color?: string
  /** Whether the control is disabled (e.g., mech destroyed) */
  disabled?: boolean
  /** Size variant matching ValueDisplay sizing */
  size?: 'sm' | 'md'
}

export function InteractiveStatDisplay({
  label,
  value,
  max,
  min = 0,
  onChange,
  color,
  disabled = false,
  size = 'md',
}: InteractiveStatDisplayProps) {
  const isReadOnly = !onChange || disabled
  const atMin = value <= min
  const atMax = value >= max
  const fontSize = size === 'sm' ? 'text-xs' : 'text-base'

  return (
    <div className={cn('flex flex-col items-center gap-0.5', disabled && 'opacity-40')}>
      <Text
        variant="pseudoheader"
        as="span"
        className={cn('uppercase', fontSize, 'font-semibold', color && color)}
        style={color ? undefined : undefined}
      >
        {label}
      </Text>
      <div className="flex items-center gap-1">
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => onChange(Math.max(min, value - 1))}
            disabled={atMin}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded border border-su-black font-mono font-bold leading-none transition-colors',
              size === 'sm' ? 'h-5 w-5 text-xs' : 'h-6 w-6 text-sm',
              atMin
                ? 'cursor-not-allowed opacity-30'
                : 'cursor-pointer hover:bg-su-black hover:text-su-white'
            )}
            aria-label={`Decrease ${label}`}
          >
            −
          </button>
        )}
        <span className={cn('inline-flex shrink-0 border border-su-black whitespace-nowrap')}>
          <Text
            variant="pseudoheaderInverse"
            as="span"
            className={cn('uppercase font-semibold', fontSize)}
          >
            {value}
          </Text>
          <Text
            variant="pseudoheader"
            as="span"
            className={cn('uppercase font-semibold', fontSize)}
          >
            {max}
          </Text>
        </span>
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => onChange(Math.min(max, value + 1))}
            disabled={atMax}
            className={cn(
              'flex items-center justify-center rounded border border-su-black font-mono font-bold leading-none transition-colors',
              size === 'sm' ? 'h-5 w-5 text-xs' : 'h-6 w-6 text-sm',
              atMax
                ? 'cursor-not-allowed opacity-30'
                : 'cursor-pointer hover:bg-su-black hover:text-su-white'
            )}
            aria-label={`Increase ${label}`}
          >
            +
          </button>
        )}
      </div>
    </div>
  )
}
