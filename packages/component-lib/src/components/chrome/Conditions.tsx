import { cn } from '../../utils/cn'
import { Badge } from './Badge'

type ConditionChipProps = {
  label: string
  /** Solid warn fill (default — a listed condition is active) */
  active?: boolean
  onRemove?: () => void
  onClick?: () => void
  className?: string
}

/**
 * Condition chip (design-spec §2.10 `.cond__chip`): active = solid warn fill,
 * inactive = the ink outline, optional '×' remove. The label and the remove
 * glyph are sibling buttons (never nested) so both stay keyboard-operable.
 *
 * The frame is `Badge` — this used to hand-roll the chip geometry (1.5px frame,
 * `py-[3px]`, and an ink border even under the warn fill), which is exactly the
 * drift the one-label-chip rule exists to kill. It now maps onto the canonical
 * surfaces (`tone`+`warn` when active, `outline` when not), so a condition chip
 * is a Badge that happens to carry buttons. `Badge` renders arbitrary children
 * inside a non-interactive `<span>`, so the two controls stay valid and
 * focusable.
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
    <Badge
      surface={active ? 'tone' : 'outline'}
      tone={active ? 'warn' : undefined}
      className={cn('gap-1.5', className)}
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
    </Badge>
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
      {/* An ACTION, not a label, so it stays a plain button rather than going
          through Badge — but it mirrors Badge's chip metrics (22px, rounded-badge,
          border-2, px-[9px]) so it sits flush with the ConditionChips beside it. */}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-[22px] cursor-pointer items-center rounded-badge border-2 border-dashed border-wk-faint px-[9px] font-cond text-badge font-semibold uppercase leading-none tracking-caps text-wk-muted hover:border-ink hover:text-ink"
        >
          + Add
        </button>
      )}
    </div>
  )
}
