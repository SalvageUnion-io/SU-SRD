import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useState } from 'react'
import type { SURefObjectChoice } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { cn } from '../../../utils/cn'
import { useParseTraitReferences } from '../../../utils/parseTraitReferences'
import { Text } from '../../base/Text'
import { Badge } from '../../chrome/Badge'
import { RollTable } from '../../shared/RollTable'
import {
  type ChoiceSelections,
  getChoiceCardOptions,
  getChoiceSourceKind,
  getChoiceTableName,
  isMultiSelectChoice,
  resolveMultiSelectCap,
  toggleSelection,
} from './choiceSelectionHelpers'
import { accentDeepColor } from '../referenceEntityHelpers'

/**
 * ChoiceGroups — the write-layer choice renderer in the NEW design language.
 *
 * A choice is just another nested group: a dashed `Slab` (the choice name) over a
 * masonry of compact option cards, in the SAME chrome as any nested card — a tone
 * band with a black name-tab (the option label) + a paper description body. The
 * selection layer is the exact write-layer idiom: dim-until-chosen (editable) and
 * the canonical rust `SELECTION_RING` when chosen. Read-only shows every option
 * full and static (the choices are readable; they just aren't choosable).
 *
 * A drop-in for the legacy `ChoiceGroups` — it reuses the identical selection
 * state machinery (controlled / ephemeral, id-keyed, cap resolution) so ITUN
 * persistence and the SRD ephemeral case both keep working unchanged.
 */

type ChoiceGroupsProps = {
  choices: SURefObjectChoice[]
  /** Parent entity — resolves `scalesWithField` caps (e.g. techLevel). */
  parent?: Record<string, unknown>
  /** Controlled selections (id-keyed). With `onSelectionChange` → controlled. */
  selections?: ChoiceSelections
  onSelectionChange?: (selections: ChoiceSelections) => void
  /** Static (readable, not choosable) — the SRD reference / snapshots. */
  readOnly?: boolean
  compact?: boolean
  /** Parent tone as a raw CSS colour — the option-card band + Slab/frame colour. */
  toneColor?: string
}

/** A selectable OPTION card — the NEW compact-card chrome (tone band + black
 *  name-tab + paper body), dim-until-chosen with the rust ring when chosen.
 *  The card grid is a deliberate break from the book's prose list. */
function ChoiceOption({
  label,
  description,
  chosen,
  readOnly,
  onToggle,
  toneColor,
  compact,
}: {
  label: string
  description?: string
  chosen: boolean
  readOnly?: boolean
  onToggle: () => void
  toneColor?: string
  compact?: boolean
}): ReactNode {
  const parsedDescription = useParseTraitReferences(description ?? '')
  const frameColor = accentDeepColor(undefined, toneColor) ?? 'var(--color-ink)'
  const card = (
    <div className="relative">
      {chosen && (
        <Badge shape="stamp" seam size="mini" className="right-2">
          Chosen
        </Badge>
      )}
      <div className="overflow-hidden rounded-card" style={{ border: `3px solid ${frameColor}` }}>
        <div
          className={cn('flex items-center', compact ? 'px-2 py-1' : 'px-2.5 py-1.5')}
          style={{ backgroundColor: toneColor }}
        >
          <Text
            variant="pseudoheader"
            as="span"
            className={cn(
              'w-fit font-cond font-bold uppercase leading-none tracking-caps-tight',
              compact ? 'text-xs' : 'text-sm'
            )}
          >
            {label}
          </Text>
        </div>
        {description && (
          <div
            className={cn(
              'bg-paper leading-snug text-ink',
              compact ? 'px-2.5 py-1.5 text-label' : 'px-3 py-2 text-xs'
            )}
          >
            {parsedDescription}
          </div>
        )}
      </div>
    </div>
  )
  const wrap = cn(
    'block rounded-card transition-opacity duration-150',
    !readOnly && !chosen && 'opacity-45'
  )
  return (
    <button
      type="button"
      aria-pressed={chosen}
      onClick={readOnly ? undefined : onToggle}
      className={cn('w-full text-left', wrap, readOnly && 'cursor-default')}
    >
      {card}
    </button>
  )
}

/**
 * A free-text choice input with an xs stampseal LABEL riding the upper border.
 * The label floats: while the field is empty and unfocused it sits inside the
 * field (acting as the placeholder); on focus or once there's a value it rides
 * the top border, out of the way of what's being typed. Peer-driven, no JS.
 */
function StampsealField({
  label,
  value,
  multiline,
  onChange,
}: {
  label: string
  value: string
  multiline?: boolean
  onChange: (value: string) => void
}): ReactNode {
  const fieldClass =
    'peer w-full rounded border border-ink/20 bg-paper px-2 pt-3.5 pb-1 font-body text-xs text-ink focus:border-rust focus:outline-none'
  const badge = (
    // A single space placeholder makes `:placeholder-shown` track "is empty".
    <span
      className={cn(
        'pointer-events-none absolute left-2 top-0 -translate-y-1/2 transition-all duration-150',
        // Empty + unfocused → sit inside the field like a placeholder…
        'peer-placeholder-shown:top-3.5 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:opacity-60',
        // …focused → snap back up to ride the border.
        'peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:opacity-100'
      )}
    >
      <Badge shape="stamp" size="mini">
        {label}
      </Badge>
    </span>
  )
  return (
    <div className="relative">
      {multiline ? (
        <textarea
          aria-label={label}
          className={fieldClass}
          rows={2}
          value={value}
          placeholder=" "
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          aria-label={label}
          className={fieldClass}
          value={value}
          placeholder=" "
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {badge}
    </div>
  )
}

/** One choice group: a dashed Slab (name + optional n/max) over the option cards,
 *  or a single NEW-chrome input card for a free-text choice (Name / Motto / …). */
function ChoiceOptionGroup({
  choice,
  selected,
  cap,
  onToggleOption,
  onFreeTextChange,
  readOnly,
  compact,
  toneColor,
}: {
  choice: SURefObjectChoice
  selected: string[]
  cap?: number
  onToggleOption: (value: string) => void
  onFreeTextChange: (value: string) => void
  readOnly?: boolean
  compact?: boolean
  toneColor?: string
}): ReactNode {
  const toneVar = { '--tone-deep': toneColor } as CSSProperties
  const kind = getChoiceSourceKind(choice)
  const value = selected[0] ?? ''

  // TEXT — an editable field; in READ-ONLY the chosen value as prose, or NOTHING
  // when empty (a simple input has no reference content of its own to show). No
  // box, no label, no repeated prompt.
  if (kind === 'text') {
    if (readOnly) {
      return value ? <p className="font-body text-xs font-bold text-ink">{value}</p> : null
    }
    return (
      <StampsealField
        label={choice.name}
        value={value}
        multiline={choice.name.toLowerCase() !== 'name'}
        onChange={onFreeTextChange}
      />
    )
  }

  // TABLE — the roll table via its own header (title + Roll button always shown)
  // with the rows collapsed behind a Show/Hide toggle. Editable adds a "choose
  // your own" field that a roll fills; read-only just exposes the rollable table.
  if (kind === 'table') {
    const tableName = getChoiceTableName(choice)
    const tableEntity = tableName
      ? SalvageUnionReference.RollTables.find((t) => t.name === tableName)
      : undefined
    const table = tableEntity && 'table' in tableEntity ? tableEntity.table : undefined
    return (
      <div className="flex flex-col gap-1.5">
        {readOnly ? (
          // A previously-chosen value (e.g. a snapshot) still shows as prose.
          value && <p className="font-body text-xs font-bold text-ink">{value}</p>
        ) : (
          // The field ALWAYS shows in editable — it holds the chosen value, and
          // rolling the table below fills it (RollTable.onRollResult).
          <StampsealField label={choice.name} value={value} onChange={onFreeTextChange} />
        )}
        {table && (
          <RollTable
            table={table}
            tableName={`${tableName} Table`}
            compact
            collapsible
            onRollResult={readOnly ? undefined : (text) => onFreeTextChange(text)}
          />
        )}
      </div>
    )
  }

  // OPTIONS / catalog / systemVariant — the option cards. No group Slab or band
  // label (the anchored prose introduces them); an editable multi-select shows a
  // small n/max counter.
  const multi = isMultiSelectChoice(choice)
  const counter = multi && typeof cap === 'number' ? `${selected.length}/${cap}` : undefined
  const options = getChoiceCardOptions(choice)
  return (
    <div style={toneVar}>
      {counter && !readOnly && <div className="mb-1 font-body text-nano text-ink-2">{counter}</div>}
      <div className={cn('gap-1.5', compact ? 'columns-1' : 'columns-1 sm:columns-2')}>
        {options.map((option) => (
          <div key={option.value} className="mb-1.5 break-inside-avoid pt-2.5">
            <ChoiceOption
              label={option.label}
              description={option.description}
              chosen={selected.includes(option.value)}
              readOnly={readOnly}
              onToggle={() => onToggleOption(option.value)}
              toneColor={toneColor}
              compact={compact}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ChoiceGroups({
  choices,
  parent,
  selections: controlled,
  onSelectionChange,
  readOnly,
  compact,
  toneColor,
}: ChoiceGroupsProps) {
  const isControlled = controlled !== undefined
  const [internal, setInternal] = useState<ChoiceSelections>({})
  const selections = isControlled ? controlled : internal

  const commit = useCallback(
    (next: ChoiceSelections) => {
      if (!isControlled) setInternal(next)
      onSelectionChange?.(next)
    },
    [isControlled, onSelectionChange]
  )
  const toggleOption = useCallback(
    (choice: SURefObjectChoice, value: string) => {
      const current = selections[choice.id] ?? []
      commit({
        ...selections,
        [choice.id]: toggleSelection(current, value, isMultiSelectChoice(choice)),
      })
    },
    [selections, commit]
  )
  const freeTextChange = useCallback(
    (choice: SURefObjectChoice, value: string) => {
      commit({ ...selections, [choice.id]: value.length > 0 ? [value] : [] })
    },
    [selections, commit]
  )

  if (choices.length === 0) return null
  return (
    <div className={cn('flex flex-col', compact ? 'gap-3' : 'gap-4')}>
      {choices.map((choice) => (
        <ChoiceOptionGroup
          key={choice.id}
          choice={choice}
          selected={selections[choice.id] ?? []}
          cap={resolveMultiSelectCap(choice, parent)}
          onToggleOption={(value) => toggleOption(choice, value)}
          onFreeTextChange={(value) => freeTextChange(choice, value)}
          readOnly={readOnly}
          compact={compact}
          toneColor={toneColor}
        />
      ))}
    </div>
  )
}
