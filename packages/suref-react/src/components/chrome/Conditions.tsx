import { cn } from '../../utils/cn'

type ConditionChipProps = {
  label: string
  /** Solid warn fill (default — a listed condition is active) */
  active?: boolean
  onRemove?: () => void
  onClick?: () => void
  className?: string
}

/**
 * Condition chip (design-spec §2.10 `.cond__chip`): 1.5px ink frame, active =
 * solid warn fill with white text, optional '×' remove. The label and the
 * remove glyph are sibling buttons (never nested) so both stay keyboard-
 * operable.
 */
export function ConditionChip({
  label,
  active = true,
  onRemove,
  onClick,
  className,
}: ConditionChipProps) {
  const labelNode = onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="cursor-pointer uppercase focus-visible:outline-none"
    >
      {label}
    </button>
  ) : (
    <span>{label}</span>
  )
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-badge border-chrome border-ink px-2 py-[3px] font-cond text-badge font-semibold uppercase leading-none',
        active ? 'bg-status-warn text-paper' : 'bg-paper text-ink',
        className
      )}
    >
      {labelNode}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
          className="cursor-pointer font-body leading-none opacity-80 hover:opacity-100"
        >
          ×
        </button>
      )}
    </span>
  )
}

type ConditionsProps = {
  conditions: string[]
  onRemove?: (condition: string) => void
  /** Renders a trailing dashed '+ Add' chip when provided */
  onAdd?: () => void
  className?: string
}

/**
 * Conditions chip row (design-spec §2.10): active condition chips with ×
 * remove and a trailing dashed '+ Add' affordance.
 */
export function Conditions({ conditions, onRemove, onAdd, className }: ConditionsProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {conditions.map((condition) => (
        <ConditionChip
          key={condition}
          label={condition}
          onRemove={onRemove ? () => onRemove(condition) : undefined}
        />
      ))}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex cursor-pointer items-center rounded-badge border-chrome border-dashed border-wk-faint px-2 py-[3px] font-cond text-badge font-semibold uppercase leading-none text-wk-muted hover:border-ink hover:text-ink"
        >
          + Add
        </button>
      )}
    </div>
  )
}
