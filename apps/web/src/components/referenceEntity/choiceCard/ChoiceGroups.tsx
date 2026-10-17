import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useContext, useState } from 'react'
import type { RefEntity, RefObjectChoice } from 'salvageunion-reference'
import { isSchemaName, SalvageUnionReference } from 'salvageunion-reference'
import { color, font, fontSize, space, tracking, weight } from '../../../design/tokens'
import { cn } from '../../../lib/cn'
import { useParseTraitReferences } from '../../../lib/parseTraitReferences'
import type { CSSVarStyle } from '../../../styles/cssVars'
import { Badge } from '../../atoms/Badge'
import { FOCUS_RING, INPUT_FOCUS } from '../../atoms/interaction'
import { SELECTED_RING } from '../../entity/modes/selectedRing'
import { InsidePeekContext } from '../../entity/peekContext'
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
 * resolution) serves Cantina persistence and the SRD ephemeral case alike.
 */

type ChoiceGroupsProps = {
  choices: RefObjectChoice[]
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
type EntityOption = {
  entity: RefEntity
  label: string
  chosen: boolean
  /** Static (readable, not choosable). */
  readOnly: boolean
  /** At-cap multi-select: an unchosen option can't be added until one is removed. */
  disabled: boolean
  onToggle: () => void
}

/** The entity a catalog option names, when its schema is loaded and holds it. */
function resolveOptionEntity(option: ChoiceCardOption): RefEntity | undefined {
  if (!option.schema || !isSchemaName(option.schema)) return undefined
  try {
    const target = option.value.toLowerCase()
    const found = SalvageUnionReference.findIn(
      option.schema,
      (e) => 'name' in e && String(e.name).toLowerCase() === target
    )
    return found && 'id' in found && typeof found.id === 'string' ? (found as RefEntity) : undefined
  } catch {
    return undefined
  }
}

/** The option card's frame, by density — the compact card's ink frame (ruleset §5). */
const FRAME_WIDTH = { regular: 'var(--bw-entity-compact)', compact: 'var(--bw-chrome)' }

/** A read-only chosen value, set as bold prose (`text-xs`, its line height included). */
const chosenValueStyle = {
  fontFamily: font.body,
  fontSize: fontSize.xs,
  lineHeight: '1rem',
  fontWeight: weight.bold,
  color: color.ink,
} satisfies CSSProperties

/** One masonry cell: never split across columns; room above for the top rail. */
const optionCellStyle = {
  marginBottom: space[6],
  breakInside: 'avoid',
  paddingTop: space[10],
} satisfies CSSProperties

/**
 * The free-text field's static geometry. Its border COLOUR lives on
 * `.su-stampseal-field__input` (it darkens on `:focus`), so only the width and
 * style are set here.
 */
const fieldStyle = {
  width: '100%',
  borderRadius: '0.25rem',
  borderWidth: '1px',
  borderStyle: 'solid',
  backgroundColor: color.paper,
  padding: `${space[14]} ${space[8]} ${space[4]}`,
  fontFamily: font.body,
  fontSize: fontSize.xs,
  lineHeight: '1rem',
  color: color.ink,
} satisfies CSSProperties

/**
 * The floating label's static half; `top` / `translate` / `opacity` follow the
 * field's state, so they live on `.su-stampseal-field__label`.
 */
const fieldLabelStyle = {
  pointerEvents: 'none',
  position: 'absolute',
  left: space[8],
  transitionProperty: 'all',
  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
  transitionDuration: '150ms',
} satisfies CSSProperties

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
  const button = {
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
  } satisfies CSSProperties
  const frame = {
    backgroundColor: 'var(--color-paper)',
    borderColor: 'var(--color-ink)',
    borderStyle: 'solid',
    borderWidth: compact ? FRAME_WIDTH.compact : FRAME_WIDTH.regular,
    borderRadius: 'var(--radius-card)',
    overflow: 'hidden',
    ...(chosen ? SELECTED_RING : undefined),
  } satisfies CSSProperties
  const head = {
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
  } satisfies CSSProperties
  const body = {
    color: color.ink,
    fontSize: compact ? fontSize.badge : fontSize.xs,
    lineHeight: 1.375,
    padding: compact ? `${space[6]} ${space[8]}` : `${space[8]} ${space[10]}`,
  } satisfies CSSProperties
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
  const fieldClass = cn('su-stampseal-field__input', INPUT_FOCUS)
  const badge = (
    // A single space placeholder makes `:placeholder-shown` track "is empty".
    // The float (inside while empty, riding the border on focus or with a
    // value) is the sibling selectors on `.su-stampseal-field__label`.
    <span className="su-stampseal-field__label" style={fieldLabelStyle}>
      <Badge shape="stamp" size="mini">
        {label}
      </Badge>
    </span>
  )
  return (
    <div style={{ position: 'relative' }}>
      {multiline ? (
        <textarea
          aria-label={label}
          className={fieldClass}
          style={fieldStyle}
          rows={2}
          value={value}
          placeholder=" "
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          aria-label={label}
          className={fieldClass}
          style={fieldStyle}
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
  choice: RefObjectChoice
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
      return value ? <p style={chosenValueStyle}>{value}</p> : null
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[6] }}>
        {readOnly ? (
          // A previously-chosen value (e.g. a snapshot) still shows as prose.
          value && <p style={chosenValueStyle}>{value}</p>
        ) : (
          // The field ALWAYS shows in editable — it holds the chosen value, and
          // rolling the table below fills it (RollTable.onRollResult).
          <StampsealField label={choice.name} value={value} onChange={onFreeTextChange} />
        )}
        {table && !insidePeek && (
          <CardRollTable
            table={table}
            name={`${tableName} Table`}
            size={compact ? 'mini' : 'compact'}
            framed
            nested
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
      {/* Masonry columns: one, or two from `sm` unless compact — a class
          (`.su-choice-options`), since the column count is responsive. */}
      <div
        className={cn('su-choice-options', !compact && 'su-choice-options--split')}
        style={{ gap: space[6] }}
      >
        {options.map((option) => {
          const chosen = selected.includes(option.value)
          const disabled = !readOnly && atCap && !chosen
          const onToggle = () => onToggleOption(option.value)
          const entity = renderEntityOption ? resolveOptionEntity(option) : undefined
          return (
            <div key={option.value} style={optionCellStyle}>
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
    (choice: RefObjectChoice, value: string) => {
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
    (choice: RefObjectChoice, value: string) => {
      commit({ ...selections, [choice.id]: value.length > 0 ? [value] : [] })
    },
    [selections, commit]
  )

  if (choices.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? space[12] : space[16] }}>
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
