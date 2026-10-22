import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useContext, useId, useState } from 'react'
import type { RefEntity, RefObjectChoice } from 'salvageunion-reference'
import { isSchemaName, SalvageUnionReference } from 'salvageunion-reference'
import { color, font, fontSize, space, weight } from '../../../design/tokens'
import { cn } from '../../../lib/cn'
import { useParseTraitReferences } from '../../../lib/useProseRefs'
import type { CSSVarStyle } from '../../../styles/cssVars'
import { capsLabel } from '../../atoms/capsLabel'
import { Field } from '../../atoms/Field'
import { Input, Textarea } from '../../atoms/inputs'
import { Stat } from '../../atoms/Stat'
import { ToggleCard } from '../../atoms/ToggleCard'
import { Box } from '../../containers/Box'
import { SlabSection } from '../../containers/SlabSection'
import { TitledBox } from '../../containers/TitledBox'
import type { Paint } from '../../entity'
import { SelectedSeal } from '../../entity/modes/select'
import { SELECT_DIM, SELECTED_RING } from '../../entity/modes/selectedRing'
import { InsidePeekContext, tablePeekAddress } from '../../entity/peekContext'
import { CardRollTable } from '../card/CardRollTable'
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

/** An option's name: bold condensed caps, from the recipe. */
const NAME_CAPS = capsLabel()

/**
 * ChoiceGroups — the write-layer choice renderer in the NEW design language.
 *
 * A choice is just another nested group: a masonry of options. An option
 * that IS an entity (a catalog shortlist — Ballistic / Energy, Thermal
 * Optics…) is that entity's Mini (`renderEntityOption`); any other option is
 * drawn by where it sits (`ChoiceOption`): on its entity's Page a headed
 * option card, elsewhere untitled (N1). The selection layer is the card's own
 * write-layer idiom: dim-until-chosen (editable), the canonical
 * `SELECTED_RING` when chosen, and on its Page the "Chosen" seal on its head. Read-only shows every option full and static
 * (the choices are readable; they just aren't choosable).
 *
 * One selection state machinery (controlled / ephemeral, id-keyed, cap
 * resolution) serves app persistence and the SRD ephemeral case alike.
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
   * Renders an option that resolves to an entity as that entity's Mini
   * (the card supplies it, so this file never imports the card back). Absent,
   * every option takes the plain option card.
   */
  renderEntityOption?: (option: EntityOption) => ReactNode
  /**
   * The choice is its entity's own Page's (level 1): an option that is not an
   * entity is a headed option card. Elsewhere it is level 2 and untitled (N1).
   */
  onPage?: boolean
}

/** An option that IS an entity, with its selection state, for `renderEntityOption`. */
type EntityOption = {
  entity: RefEntity
  /** The choice is its entity's own Page's: the option's Mini is contentful. */
  onPage: boolean
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
  paddingTop: space[12],
} satisfies CSSProperties

/**
 * The toggle around an option's box: it fills its cell, and pressed it wears
 * select's ring on the box's square frame (`SELECTED_RING`), as a selected
 * Box does.
 */
const TOGGLE = {
  background: 'none',
  border: 0,
  color: 'inherit',
  display: 'block',
  font: 'inherit',
  padding: 0,
  textAlign: 'left',
  width: '100%',
} satisfies CSSProperties

/** An editable option's name off a Page, over its text in the plain box. */
const optionNameStyle = {
  color: color.ink,
  fontSize: fontSize.caption,
  lineHeight: 1.15,
} satisfies CSSProperties

/** Off a Page, an option's text at the card body's size. */
const optionTextStyle = {
  color: color.ink,
  fontSize: fontSize.xs,
  lineHeight: 1.5,
  margin: 0,
} satisfies CSSProperties

/**
 * A selectable OPTION that is not an entity. On its entity's own Page (level
 * 1) it is a `TitledBox` (ruleset §5): the tone head with the option's name on
 * its cut-out and the CHOICE chip, or the "Chosen" seal once chosen, on the
 * band's right, over the paper body; in the one select dim until chosen, and
 * ringed when chosen.
 *
 * Anywhere else it sits inside a card at level 2, where nothing is titled
 * (N1, N5) and nothing is sealed (hard rule R15): read-only (a Peek included)
 * its name is a Slab over its text, unframed, ringed when it was chosen;
 * editable it is an unheaded `Box`, its name and text on the paper, pressed
 * and ringed when chosen, in the one dim until then, with no band or seal.
 *
 * Editable, the box sits in a `ToggleCard`, the one control (`aria-pressed`).
 */
function ChoiceOption({
  label,
  description,
  chosen,
  readOnly,
  disabled,
  onToggle,
  toneColor,
  onPage,
}: {
  label: string
  description?: string
  chosen: boolean
  readOnly?: boolean
  /** At-cap multi-select: an unchosen option can't be added until one is removed. */
  disabled?: boolean
  onToggle: () => void
  toneColor?: string
  /** The option is its entity's own Page's (level 1): the headed option card. */
  onPage?: boolean
}): ReactNode {
  const parsedDescription = useParseTraitReferences(description ?? '')
  const insidePeek = useContext(InsidePeekContext)
  if (insidePeek || (!onPage && readOnly)) {
    return (
      <SlabSection title={label} style={chosen ? SELECTED_RING : undefined}>
        {/* The ring is the mark; a screen reader hears it said. */}
        {chosen && <span className="su-sr-only">Chosen</span>}
        {description && <p style={optionTextStyle}>{parsedDescription}</p>}
      </SlabSection>
    )
  }
  const text = description ? <p style={optionTextStyle}>{parsedDescription}</p> : null
  // Level 1 on its Page: a titled box, select mode's seal on the band's right
  // (R15); unchosen, the CHOICE chip says it is one to pick.
  const box = onPage ? (
    <TitledBox
      title={label}
      paint={optionPaint(toneColor)}
      affordance={
        chosen ? <SelectedSeal word="Chosen" /> : <Stat label="Choice" size="compact" hollow />
      }
    >
      {text}
    </TitledBox>
  ) : (
    <Box>
      <span className={NAME_CAPS} style={optionNameStyle}>
        {label}
      </span>
      {text}
    </Box>
  )
  // Read-only on its Page: the box alone, ringed when it was chosen.
  if (readOnly) {
    return <div style={chosen ? SELECTED_RING : undefined}>{box}</div>
  }
  return (
    <ToggleCard
      pressed={chosen}
      disabled={disabled}
      onClick={onToggle}
      // The one select dim (R15): unchosen, whether or not the cap allows it.
      className={cn(!chosen && SELECT_DIM)}
      style={{
        ...TOGGLE,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...(chosen ? SELECTED_RING : {}),
      }}
    >
      {box}
    </ToggleCard>
  )
}

/** A Page option's band: its entity's tone, as its text band, else ink. */
function optionPaint(toneColor: string | undefined): Paint {
  const band = textBand(toneColor)
  if (!band) return { background: 'var(--color-ink)', color: color.paper, ink: true }
  return {
    background: band,
    color: onTone(band, 'ink') === 'paper' ? color.paper : color.ink,
    ink: false,
  }
}

/**
 * A free-text choice (Name / Motto / a table's "choose your own"): the one
 * labelled field, `Field` over `Input` or `Textarea` (hard rule R16), so it
 * types at 16px and never zooms an iPhone.
 */
function ChoiceTextField({
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
  const id = useId()
  return (
    <Field label={label} htmlFor={id}>
      {multiline ? (
        <Textarea id={id} rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  )
}

/** One choice group: a Slab (name + optional n/max) over the option cards,
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
  onPage,
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
  onPage?: boolean
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
      <ChoiceTextField
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
          <ChoiceTextField label={choice.name} value={value} onChange={onFreeTextChange} />
        )}
        {table && !insidePeek && (
          <CardRollTable
            table={table}
            name={`${tableName} Table`}
            size={compact ? 'mini' : 'compact'}
            // Collapsed into its header everywhere, a Page included: name and
            // Roll the Die, its rows its Peek's; a Compact
            // head beside a Full host's, a Mini in a card's.
            nested
            nestedSize={compact ? 'mini' : 'compact'}
            peekAt={tablePeekAddress(tableEntity)}
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
  const entities = options.map((option) =>
    renderEntityOption ? resolveOptionEntity(option) : undefined
  )
  // On its Page an entity option is a contentful Mini a line wide (R39,
  // Bionic Senses), so one column.
  const split = !compact && !(onPage && entities.some(Boolean))
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
      {/* Masonry columns: one, or two from `sm` unless compact or a Page's
          entity options — a class
          (`.su-choice-options`), since the column count is responsive. */}
      <div
        className={cn('su-choice-options', split && 'su-choice-options--split')}
        style={{ gap: space[6] }}
      >
        {options.map((option, index) => {
          const chosen = selected.includes(option.value)
          const disabled = !readOnly && atCap && !chosen
          const onToggle = () => onToggleOption(option.value)
          const entity = entities[index]
          return (
            <div key={option.value} style={optionCellStyle}>
              {entity && renderEntityOption ? (
                renderEntityOption({
                  entity,
                  onPage: !!onPage,
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
                  onPage={onPage}
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
  onPage,
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
          onPage={onPage}
        />
      ))}
    </div>
  )
}
