import { cn } from '../../utils/cn'
import { Badge } from './Badge'
import { capsLabel } from './capsLabel'
import { FOCUS_RING } from './interaction'

/**
 * Chip material for a chip row.
 * - `warn` (default) — the condition treatment: solid warn fill when active,
 *   the ink outline when not.
 * - `quiet` — the NEUTRAL rung: a muted ground, no status colour, and prose
 *   casing instead of caps. This is the rung for chip rows that list freeform
 *   *facts* rather than conditions (a crawler NPC's facts), where a warn fill
 *   would read as an alarm and caps would shout a sentence.
 */
export type ConditionChipTone = 'warn' | 'quiet'

type ConditionChipProps = {
  label: string
  /** Solid warn fill (default — a listed condition is active) */
  active?: boolean
  /** Chip material — see {@link ConditionChipTone}. Defaults to `warn`. */
  tone?: ConditionChipTone
  onRemove?: () => void
  /** Accessible label for the remove control; defaults to `Remove condition ${label}`.
   * Pass a subject-scoped label (e.g. "Clear On Fire on Raider") when several
   * chip rows share a page, so the accessible names stay distinct. */
  removeLabel?: string
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
  tone = 'warn',
  onRemove,
  removeLabel,
  onClick,
  className,
}: ConditionChipProps) {
  const quiet = tone === 'quiet'
  const labelNode = onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'cursor-pointer rounded-badge',
        quiet ? 'normal-case' : 'uppercase',
        FOCUS_RING
      )}
    >
      {label}
    </button>
  ) : (
    <span>{label}</span>
  )
  return (
    <Badge
      surface={quiet ? 'quiet' : active ? 'tone' : 'outline'}
      tone={!quiet && active ? 'warn' : undefined}
      // `normal-case` is part of what `quiet` MEANS here: the neutral rung
      // carries prose, and Badge's baked-in `uppercase` would shout it.
      className={cn('gap-1.5', quiet && 'normal-case', className)}
    >
      {labelNode}
      {onRemove && (
        // 24px hit area (WCAG 2.5.8) — negative margins keep the chip visually
        // compact (22px Badge) while the target stays tappable.
        <button
          type="button"
          aria-label={removeLabel ?? `Remove condition ${label}`}
          onClick={onRemove}
          className="-my-1 -mr-1.5 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center font-body leading-none opacity-80 hover:opacity-100"
        >
          ×
        </button>
      )}
    </Badge>
  )
}

type ConditionsProps = {
  conditions: string[]
  /**
   * Remove handler. The index is passed alongside the value because these rows
   * are free-form strings that may repeat: a facts row removes by position,
   * while a conditions row (a flat set) can ignore it and remove by value.
   */
  onRemove?: (condition: string, index: number) => void
  /** Per-condition accessible label for the remove control (see ConditionChip). */
  removeLabel?: (condition: string) => string
  /** Renders a trailing dashed '+ Add' chip when provided */
  onAdd?: () => void
  /**
   * Accessible label for that '+ Add' chip. Defaults to 'Add condition'; pass a
   * subject-scoped label (e.g. "Add Command Bay crew fact") when the row is not
   * a conditions row, or when several rows share a page.
   */
  addLabel?: string
  /** Chip material for every chip in the row — see {@link ConditionChipTone}. */
  tone?: ConditionChipTone
  className?: string
}

/**
 * Conditions chip row (design-spec §2.10): active condition chips with ×
 * remove and a trailing dashed '+ Add' affordance.
 *
 * Despite the name this is the one chip-row primitive for any free-form string
 * list a sheet lets a player edit — `tone="quiet"` + `addLabel` is how a
 * non-condition row (NPC facts) uses it without hand-rolling chip geometry.
 */
export function Conditions({
  conditions,
  onRemove,
  removeLabel,
  onAdd,
  addLabel,
  tone,
  className,
}: ConditionsProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {conditions.map((condition, index) => (
        <ConditionChip
          // biome-ignore lint/suspicious/noArrayIndexKey: conditions are free-form strings that may repeat; value+index is the most stable key available and chips hold no state
          key={`${condition}-${index}`}
          label={condition}
          tone={tone}
          onRemove={onRemove ? () => onRemove(condition, index) : undefined}
          removeLabel={removeLabel?.(condition)}
        />
      ))}
      {/* An ACTION, not a label, so it stays a plain button rather than going
          through Badge — but it mirrors Badge's chip metrics (22px, rounded-badge,
          border-2, px-[9px]) so it sits flush with the ConditionChips beside it. */}
      {onAdd && (
        <button
          type="button"
          aria-label={addLabel ?? 'Add condition'}
          onClick={onAdd}
          className={cn(
            capsLabel({ size: 'badge', weight: 'semibold', tracking: 'caps' }),
            'inline-flex h-[22px] cursor-pointer items-center rounded-badge border-2 border-dashed border-wk-faint px-[9px] leading-none text-wk-muted hover:border-ink hover:text-ink'
          )}
        >
          + Add
        </button>
      )}
    </div>
  )
}
