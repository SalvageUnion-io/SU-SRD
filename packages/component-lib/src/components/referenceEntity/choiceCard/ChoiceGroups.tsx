import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useContext, useState } from 'react'
import type { SURefEntity, SURefObjectChoice } from 'salvageunion-reference'
import { isSchemaName, SalvageUnionReference } from 'salvageunion-reference'
import { color, font, fontSize, space, tracking, weight } from '../../../design/tokens'
import { InsidePeekContext } from '../../../entity/peekContext'
import type { CSSVarStyle } from '../../../styles/cssVars'
import { cn } from '../../../utils/cn'
import { useParseTraitReferences } from '../../../utils/parseTraitReferences'
import { Badge } from '../../chrome/Badge'
import { FOCUS_RING, INPUT_FOCUS } from '../../chrome/interaction'
import { CardRollTable } from '../card/CardRollTable'
import { CardTopRail } from '../card/CardTopRail'
import { onTone, textBand } from '../referenceEntityHelpers'
import type { ChoiceCardOption, ChoiceSelections } from './choiceSelectionHelpers'
import {
  getChoiceCardOptions,
  getChoiceSourceKind,
  getChoiceTableName,
  isMultiSelectChoice,
  resolveMultiSelectCap,
  toggleSelection,
} from './choiceSelectionHelpers'

/**
 * ChoiceGroups — the write-layer choice renderer in the NEW design language.
 *
 * A choice is just another nested group: a masonry of option cards in the
 * compact card's anatomy. An option that IS an entity (a catalog shortlist —
 * Ballistic / Energy, Thermal Optics…) is that entity's compact card
 * (`renderEntityOption`); any other option takes the same anatomy — the ink
 * frame, the tone head with its title, the paper body. The selection layer is
 * the card's own write-layer idiom: dim-until-chosen (editable), the canonical
 * `SELECTION_RING` and the "Chosen ✓" seal when chosen. Read-only shows every
 * option full and static (the choices are readable; they just aren't
 * choosable).
 *
 * One selection state machinery (controlled / ephemeral, id-keyed, cap
 * resolution) serves ITUN persistence and the SRD ephemeral case alike.
 */

type ChoiceGroupsProps = {
  choices: SURefObjectChoice[]
  /** Parent entity — resolves `cardinality.max.scalesWith` caps (e.g. techLevel). */
  parent?: Record<string, unknown>
  /** Controlled selections (id-keyed). With `onSelectionChange` → controlled. */
  selections?: ChoiceSelections
  onSelectionChange?: (selections: ChoiceSelections) => void
  /** Static (readable, not choosable) — the SRD reference / snapshots. */
  readOnly?: boolean
  compact?: boolean
  /** Parent tone as a raw CSS colour — the option-card head band. */
  toneColor?: string
  /**
   * Renders an option that resolves to an entity as that entity's compact card
   * (the card supplies it, so this file never imports the card back). Absent,
   * every option takes the plain option card.
   */
  renderEntityOption?: (option: EntityOption) => ReactNode
}

/** An option that IS an entity, with its selection state, for `renderEntityOption`. */
export type EntityOption = {
  entity: SURefEntity
  label: string
  chosen: boolean
  /** Static (readable, not choosable). */
  readOnly: boolean
  /** At-cap multi-select: an unchosen option can't be added until one is removed. */
  disabled: boolean
  onToggle: () => void
}

/** The entity a catalog option names, when its schema is loaded and holds it. */
function resolveOptionEntity(option: ChoiceCardOption): SURefEntity | undefined {
  if (!option.schema || !isSchemaName(option.schema)) return undefined
  try {
    const target = option.value.toLowerCase()
    const found = SalvageUnionReference.findIn(
      option.schema,
      (e) => 'name' in e && String(e.name).toLowerCase() === target
    )
    return found && 'id' in found && typeof found.id === 'string'
      ? (found as SURefEntity)
      : undefined
  } catch {
    return undefined
  }
}

/** The option card's frame, by density — the compact card's ink frame (ruleset §5). */
const FRAME_WIDTH = { regular: 'var(--bw-entity-compact)', compact: 'var(--bw-chrome)' }

/**
 * A selectable OPTION that is not an entity, in the compact card's anatomy
 * (ruleset §5): an ink frame, the tone head with the option's title in ink or
 * paper (whichever the tone carries), and the paper body. Dim-until-chosen,
 * with the selection ring and the "Chosen ✓" seal when chosen — the entity
 * card's own write layer.
 */
function ChoiceOption({
  label,
  description,
  chosen,
  readOnly,
  disabled,
  onToggle,
  toneColor,
  compact,
}: {
  label: string
  description?: string
  chosen: boolean
  readOnly?: boolean
  /** At-cap multi-select: an unchosen option can't be added until one is removed. */
  disabled?: boolean
  onToggle: () => void
  toneColor?: string
  compact?: boolean
}): ReactNode {
  const parsedDescription = useParseTraitReferences(description ?? '')
  const band = textBand(toneColor)
  const onBand = onTone(band, 'ink') === 'paper' ? color.paper : color.ink
  const button: CSSProperties = {
    background: 'none',
    border: 0,
    borderRadius: 'var(--radius-card)',
    color: 'inherit',
    cursor: readOnly ? 'default' : disabled ? 'not-allowed' : 'pointer',
    display: 'block',
    font: 'inherit',
    opacity: disabled ? 0.3 : !readOnly && !chosen ? 0.45 : 1,
    padding: 0,
    textAlign: 'left',
    transition: 'opacity 150ms',
    width: '100%',
  }
  const frame: CSSProperties = {
    backgroundColor: 'var(--color-paper)',
    borderColor: 'var(--color-ink)',
    borderStyle: 'solid',
    borderWidth: compact ? FRAME_WIDTH.compact : FRAME_WIDTH.regular,
    borderRadius: 'var(--radius-card)',
    boxShadow: chosen ? '0 0 0 3px var(--color-ink)' : undefined,
    overflow: 'hidden',
  }
  const head: CSSProperties = {
    backgroundColor: band ?? 'var(--color-ink)',
    borderBottom: description ? 'var(--bw-chrome) solid var(--color-ink)' : undefined,
    color: band ? onBand : color.paper,
    fontFamily: font.cond,
    fontSize: compact ? fontSize.caption : fontSize.lede,
    fontWeight: weight.bold,
    letterSpacing: tracking.capsTight,
    lineHeight: 1.15,
    padding: compact ? `${space[6]} ${space[8]}` : `${space[8]} ${space[10]}`,
    textTransform: 'uppercase',
  }
  const body: CSSProperties = {
    color: color.ink,
    fontSize: compact ? fontSize.badge : fontSize.xs,
    lineHeight: 1.375,
    padding: compact ? `${space[6]} ${space[8]}` : `${space[8]} ${space[10]}`,
  }
  return (
    <button
      type="button"
      aria-pressed={chosen}
      disabled={disabled}
      onClick={readOnly ? undefined : onToggle}
      className={FOCUS_RING}
      style={button}
    >
      <div style={{ position: 'relative' }}>
        <CardTopRail
          controls={undefined}
          status={undefined}
          onStatusClick={undefined}
          subject={label}
          selected={chosen}
          selectionSeal="Chosen"
          multiSelect={undefined}
        />
        <div style={frame}>
          <div style={head}>{label}</div>
          {description && <div style={body}>{parsedDescription}</div>}
        </div>
      </div>
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
  const fieldClass = `peer w-full rounded border border-ink/20 bg-paper px-2 pt-3.5 pb-1 font-body text-xs text-ink focus:border-ink ${INPUT_FOCUS}`
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
  renderEntityOption,
}: {
  choice: SURefObjectChoice
  selected: string[]
  cap?: number
  onToggleOption: (value: string) => void
  onFreeTextChange: (value: string) => void
  readOnly?: boolean
  compact?: boolean
  toneColor?: string
  renderEntityOption?: (option: EntityOption) => ReactNode
}): ReactNode {
  // Terminal in a tooltip popup (ruleset §1): the table's Roll/Show controls go.
  const insidePeek = useContext(InsidePeekContext)
  const toneVar: CSSVarStyle = { '--tone-deep': toneColor }
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
      ? SalvageUnionReference.RollTables.getByName(tableName)
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
        {table && !insidePeek && (
          <CardRollTable
            table={table}
            name={`${tableName} Table`}
            size={compact ? 'small' : 'medium'}
            collapsible
            framed
            disabled={false}
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
  // At the cap, an UNCHOSEN option is disabled — a new pick can't exceed the cap
  // (deselecting a chosen option stays available).
  const atCap = multi && typeof cap === 'number' && selected.length >= cap
  const options = getChoiceCardOptions(choice)
  return (
    <div style={toneVar}>
      {counter && !readOnly && (
        <div
          style={{
            color: color.wkMuted,
            fontFamily: font.body,
            fontSize: fontSize.badge,
            marginBottom: space[4],
          }}
        >
          {counter}
        </div>
      )}
      <div className={cn('gap-1.5', compact ? 'columns-1' : 'columns-1 sm:columns-2')}>
        {options.map((option) => {
          const chosen = selected.includes(option.value)
          const disabled = !readOnly && atCap && !chosen
          const onToggle = () => onToggleOption(option.value)
          const entity = renderEntityOption ? resolveOptionEntity(option) : undefined
          return (
            <div key={option.value} className="mb-1.5 break-inside-avoid pt-2.5">
              {entity && renderEntityOption ? (
                renderEntityOption({
                  entity,
                  label: option.label,
                  chosen,
                  readOnly: !!readOnly,
                  disabled,
                  onToggle,
                })
              ) : (
                <ChoiceOption
                  label={option.label}
                  description={option.description}
                  chosen={chosen}
                  readOnly={readOnly}
                  disabled={disabled}
                  onToggle={onToggle}
                  toneColor={toneColor}
                  compact={compact}
                />
              )}
            </div>
          )
        })}
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
  renderEntityOption,
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
      // The cap is the LAST word: even though at-cap options render disabled,
      // the state transition itself also refuses to grow past the cap.
      commit({
        ...selections,
        [choice.id]: toggleSelection(
          current,
          value,
          isMultiSelectChoice(choice),
          resolveMultiSelectCap(choice, parent)
        ),
      })
    },
    [selections, commit, parent]
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
          renderEntityOption={renderEntityOption}
        />
      ))}
    </div>
  )
}
