import { X } from 'lucide-react'
import type { CSSProperties } from 'react'
import { borderWidth, font, iconSize, radius, size, space } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { atomsCopy } from '../../messages/components-atoms'
import { Badge } from './Badge'
import { capsLabel } from './capsLabel'

/**
 * Chip material for a chip row.
 * - `warn` (default) — the condition treatment: the solid warn fill.
 * - `quiet` — the NEUTRAL rung: a muted ground, no status colour, and prose
 *   casing instead of caps. This is the rung for chip rows that list freeform
 *   *facts* rather than conditions (a crawler NPC's facts), where a warn fill
 *   would read as an alarm and caps would shout a sentence.
 */
type ConditionChipTone = 'warn' | 'quiet'

type ConditionChipProps = {
  label: string
  /** Chip material — see {@link ConditionChipTone}. Defaults to `warn`. */
  tone?: ConditionChipTone
  onRemove?: () => void
  /** Accessible label for the remove control; defaults to `Remove condition ${label}`.
   * Pass a subject-scoped label (e.g. "Clear On Fire on Raider") when several
   * chip rows share a page, so the accessible names stay distinct. */
  removeLabel?: string
  className?: string
}

/** A Mini square inside the chip, no taller than it (R12). Its opacity is
 * `.su-condition-chip__remove`, which brightens it on hover. */
const REMOVE_BUTTON = {
  alignItems: 'center',
  cursor: 'pointer',
  display: 'inline-flex',
  flexShrink: 0,
  fontFamily: font.body,
  height: size.mini,
  justifyContent: 'center',
  lineHeight: 1,
  width: size.mini,
} satisfies CSSProperties

const ROW = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[6],
} satisfies CSSProperties

/** The '+ Add' chip's static geometry; its border and text colours change on
 * hover, so they are `.su-conditions__add`. */
const ADD_BUTTON = {
  alignItems: 'center',
  borderRadius: radius.badge,
  borderStyle: 'dashed',
  borderWidth: borderWidth.pill,
  cursor: 'pointer',
  display: 'inline-flex',
  height: '22px',
  lineHeight: 1,
  paddingInline: space[8],
} satisfies CSSProperties

/**
 * Condition chip (design-spec §2.10 `.cond__chip`): the solid warn fill, with
 * an optional ✕ remove button beside the label.
 *
 * The frame is `Badge`, never hand-rolled chip geometry — the drift the
 * one-label-chip rule exists to kill. It maps onto the canonical surfaces (`tone`+`warn`), so a condition chip
 * is a Badge that happens to carry a button. `Badge` renders arbitrary children
 * inside a non-interactive `<span>`, so the control stays valid and focusable.
 */
function ConditionChip({
  label,
  tone = 'warn',
  onRemove,
  removeLabel,
  className,
}: ConditionChipProps) {
  const quiet = tone === 'quiet'
  return (
    <Badge
      surface={quiet ? 'quiet' : 'tone'}
      tone={quiet ? undefined : 'warn'}
      className={className}
      // `textTransform: none` is part of what `quiet` MEANS here: the neutral
      // rung carries prose, and Badge's baked-in `uppercase` would shout it.
      style={{ gap: space[6], ...(quiet ? { textTransform: 'none' } : undefined) }}
    >
      <span>{label}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel ?? atomsCopy('removeCondition', { label })}
          onClick={onRemove}
          className="su-condition-chip__remove"
          style={REMOVE_BUTTON}
        >
          <X aria-hidden="true" size={iconSize.mini} />
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
    <div className={className} style={ROW}>
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
          aria-label={addLabel ?? atomsCopy('addCondition')}
          onClick={onAdd}
          className={cn(capsLabel({ size: 'badge', weight: 'semibold' }), 'su-conditions__add')}
          style={ADD_BUTTON}
        >
          {atomsCopy('add')}
        </button>
      )}
    </div>
  )
}
