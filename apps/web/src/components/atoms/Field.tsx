import { ChevronDown } from 'lucide-react'
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from 'react'
import { useRef, useState } from 'react'
import {
  borderWidth,
  color,
  font,
  fontSize,
  iconSize,
  radius,
  size,
  space,
  weight,
} from '../../design/tokens'
import { cn } from '../../lib/cn'
import { Eyebrow } from './Eyebrow'
import { EDIT_CUE_HOVER_CLASS } from './editLanguage'
import { Input, Textarea } from './inputs'
import { FOCUS_RING, INPUT_FOCUS } from './interaction'

type FieldCommon = {
  /**
   * The label: the small caps `Eyebrow` over the control or value, in every
   * shape (hard rule R16: one label treatment).
   */
  label: ReactNode
  /** Required asterisk after the label. */
  required?: boolean
  /**
   * Optional control on the label's line, after it: a once-per-Downtime USED
   * chip or a d20 Roll assist button.
   */
  labelAction?: ReactNode
  className?: string
}

/** Static field: the caller supplies the bordered control (Input/Textarea/Select). */
type FieldStaticProps = FieldCommon & {
  htmlFor?: string
  children: ReactNode
}

/**
 * Edit-in-place / picker field (the merged `IdentityField`): renders a stored
 * `value` inside an ink-bordered value box, its label typeset over it as Read sets it.
 * ALWAYS editable when it is given a handler — there is no section Edit toggle
 * to unlock first. The value box is DASHED: on a sheet, dashed borders and
 * steppers are the only "write here" cues (ruleset §1, Live Sheet),
 * and the Read | Edit toggle means a sheet only draws them while it is in Edit.
 * The deep-tone outline still comes on hover / focus to mark the one in hand.
 *
 * With NO handler it is the read state, and the read state is typeset, not a
 * form ("print reads, pencil writes"): a small caps
 * label over the value, no box, and nothing at all when the value is empty.
 */
type FieldEditableProps = FieldCommon & {
  /** Current stored value. */
  value: string
  /**
   * The read state's value when the field names an entity (a mech's chassis,
   * a crawler's type): its Mini, set under the label in place of the text.
   * Edit keeps `value` in the picker box.
   */
  readValue?: ReactNode
  /** Persist a freetext value — enables the edit state (edit-in-place in the value box). */
  onSave?: (next: string) => Promise<void> | void
  /**
   * Alternative edit affordance for ref-valued fields (e.g. Class → opens the
   * shared picker modal). Mutually exclusive with `onSave`.
   */
  onEditClick?: () => void
  /** Multi-line value (a 3-row textarea instead of a single-line input). */
  multiline?: boolean
  /** Read-only placeholder when the value is empty. */
  placeholder?: string
  ariaLabel?: string
  /**
   * Grow to fill the height its parent gives it, instead of hugging one row.
   * For the LAST field in a stretched card (the pilot's Bio), so the card's
   * leftover height goes into a field the reader can actually use rather than
   * sitting as dead paper under the last row.
   *
   * Read state: the value box and its readout stretch, and the text sits at the
   * TOP (a long bio should start at the first line, not float mid-box). Edit
   * state keeps the textarea's own row count — editing is transient.
   */
  fill?: boolean
  /**
   * Render the value at a larger rung. For the ONE field that names the thing
   * the card is about (a mech's Pattern Name), so it reads as the subject
   * rather than as a peer of the meta fields under it.
   */
  prominent?: boolean
}

type FieldProps = FieldStaticProps | FieldEditableProps

/**
 * The label's line: the `Eyebrow` (badge rung, bold, caps, muted), then the
 * required mark and the label's action. Placement only; the type is Eyebrow's.
 */
const LABEL_LINE = {
  alignItems: 'center',
  display: 'flex',
  gap: space[8],
  lineHeight: 1.2,
} satisfies CSSProperties

/** Over a control or a value box: a step of air between them. */
const LABEL_LINE_OVER_BOX = { ...LABEL_LINE, marginBottom: space[4] } satisfies CSSProperties

const TYPESET_VALUE = {
  color: color.ink,
  fontFamily: font.body,
  fontSize: fontSize.readout,
  lineHeight: 1.5,
  margin: `${space[4]} 0 0`,
  overflowWrap: 'anywhere',
} satisfies CSSProperties

const TYPESET_PROSE = { ...TYPESET_VALUE, whiteSpace: 'pre-line' } satisfies CSSProperties

const TYPESET_PROMINENT = { ...TYPESET_VALUE, fontSize: fontSize.title } satisfies CSSProperties

/** A read value that is a node (a Mini), not text: the value's top margin only. */
const TYPESET_NODE = {
  display: 'flex',
  margin: `${space[4]} 0 0`,
  minWidth: 0,
} satisfies CSSProperties

/**
 * The ink `Input` skin as a value-box shell (1.5px ink border, 3px radius) for
 * the picker button. A writable value box is pencil, not print: its border is
 * dashed (ruleset §1). Its paper fill changes on hover, so it is
 * `.su-field__picker`'s.
 */
const PICKER_BOX = {
  alignItems: 'center',
  borderColor: color.ink,
  borderRadius: radius.card,
  borderStyle: 'dashed',
  borderWidth: borderWidth.chrome,
  color: color.ink,
  cursor: 'pointer',
  display: 'flex',
  fontFamily: font.body,
  // Read's value size, so a picked value (a class, a type) reads as the
  // typed ones beside it do.
  fontSize: fontSize.readout,
  lineHeight: 1.5,
  minHeight: size.full,
  paddingInline: space[12],
  textAlign: 'left',
  width: '100%',
} satisfies CSSProperties

/** The edit state's value box's dashed write cue (its border is a class, `.su-field__box`). */
const WRITE_CUE = 'su-field__write-cue'

/**
 * The edit state's readout, the tap target that opens the editor: a 44px
 * minimum, filling its value box. Its alignment and colour are
 * `.su-field__readout`'s (`fill` and `prominent` restyle them through the box).
 * font-medium, not bold: a sheet is mostly filled-in fields, and at bold every
 * value competed with the ink stamps labelling it.
 */
const READOUT = {
  borderRadius: radius.card,
  cursor: 'pointer',
  display: 'inline-flex',
  fontFamily: font.body,
  fontWeight: weight.medium,
  minHeight: size.full,
  paddingInline: space[12],
  width: '100%',
} satisfies CSSProperties

const READOUT_EMPTY = { ...READOUT, fontWeight: weight.normal } satisfies CSSProperties

const FULL_WIDTH = { width: '100%' } satisfies CSSProperties

const NO_RESIZE = { resize: 'none' } satisfies CSSProperties

const FIELD_ROOT = { display: 'block', position: 'relative' } satisfies CSSProperties
const FIELD_ROOT_FILL = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  position: 'relative',
} satisfies CSSProperties

const VALUE_TEXT = {
  flex: '1 1 0%',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties
const VALUE_FILLED = { ...VALUE_TEXT, fontWeight: weight.medium } satisfies CSSProperties
const VALUE_EMPTY = { ...VALUE_TEXT, color: color.wkMuted } satisfies CSSProperties

/**
 * The ONE label (hard rule R16): the `Eyebrow` over its control or value, the
 * required mark and the label's action after it on the same line. A static
 * field's label is a real `<label for>`; the other shapes name their control
 * themselves (`Edit …`, `Change …`), so theirs is a caption.
 */
function FieldLabel({
  label,
  htmlFor,
  required,
  action,
  overBox,
}: {
  label: ReactNode
  htmlFor?: string | undefined
  required: boolean
  action: ReactNode
  overBox: boolean
}) {
  return (
    <div style={overBox ? LABEL_LINE_OVER_BOX : LABEL_LINE}>
      <Eyebrow tone="muted" as={htmlFor ? 'label' : 'span'} htmlFor={htmlFor}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </Eyebrow>
      {action}
    </div>
  )
}

/**
 * Form field block (design-spec §2.5 `.field`) — the ONE labelled control, its
 * label the small caps `Eyebrow` over the control in every shape (R16; Edit
 * looks like Read):
 *
 * 1. **static** — caller passes `children` (an `Input`/`Textarea`/`Select`);
 *    the label is its `<label for>`. Used by the wizard steps and forms.
 * 2. **edit** — `value` + `onSave`: the value in a dashed box (the
 *    `EDIT_CUE_HOVER_CLASS` cue) that a press, Enter or Space opens into an
 *    `Input` (a `Textarea` when `multiline`); Enter or a blur saves, Escape
 *    drops the draft (`FieldEditor`).
 * 3. **picker** — `value` + `onEditClick`: a button value box opening a modal.
 *
 * Shapes 2–3 are the absorbed `IdentityField`.
 *
 * 4. **typeset** — `value` with neither handler: the read state. Label over
 *    value, no box, no placeholder; an empty value renders nothing, so a read
 *    sheet omits what was never filled in.
 */
export function Field(props: FieldProps) {
  const { label, required = false, labelAction, className } = props

  // ---- Static: the label wires to a caller-supplied control. -----------------
  if ('children' in props) {
    return (
      <div className={className} style={FIELD_ROOT}>
        <FieldLabel
          label={label}
          htmlFor={props.htmlFor}
          required={required}
          action={labelAction}
          overBox
        />
        {props.children}
      </div>
    )
  }

  const {
    value,
    onSave,
    onEditClick,
    multiline = false,
    placeholder = '—',
    ariaLabel,
    fill = false,
    prominent = false,
    readValue,
  } = props
  const labelText = ariaLabel ?? (typeof label === 'string' ? label : '')

  // ---- Typeset: the read state. Nothing to write, so nothing that looks like
  // a form: the label over the value, and no row at all for an empty one. ------
  if (onSave === undefined && onEditClick === undefined) {
    if (value.trim() === '' && readValue == null) return null
    return (
      <div className={className}>
        <FieldLabel label={label} required={false} action={labelAction} overBox={false} />
        {readValue != null ? (
          <div style={TYPESET_NODE}>{readValue}</div>
        ) : (
          <p style={prominent ? TYPESET_PROMINENT : multiline ? TYPESET_PROSE : TYPESET_VALUE}>
            {value}
          </p>
        )}
      </div>
    )
  }

  // Edit sets the label as Read does, over the value, so a sheet reads the same
  // in both modes; only the dashed box says "write here".
  const typesetLabel = <FieldLabel label={label} required={required} action={labelAction} overBox />
  const valueSpan = <span style={value ? VALUE_FILLED : VALUE_EMPTY}>{value || placeholder}</span>

  // ---- Picker: a value box that opens a modal. -------------------------------
  if (onEditClick) {
    return (
      <div className={className} style={FIELD_ROOT}>
        {typesetLabel}
        <button
          type="button"
          aria-label={`Change ${labelText.toLowerCase()}`}
          onClick={onEditClick}
          // The VALUE lives inside this button, not beside it, so the print
          // stylesheets' `button:not([data-print='keep'])` rule took the
          // field's content along with its affordance: a printed sheet lost
          // the pilot's class, the mech's chassis and the crawler's type —
          // each surface's single most identifying field — while every other
          // field printed, because the edit state's readout is a
          // `<span role="button">` that the element selector never matched.
          // This is the case the hatch was written for; it is shared verbatim
          // by both apps' print CSS, so the opt-in belongs on the markup.
          // A read-only Field is typeset, with no button to hide.
          data-print="keep"
          className={cn('su-field__picker', EDIT_CUE_HOVER_CLASS, FOCUS_RING)}
          style={PICKER_BOX}
        >
          {valueSpan}
        </button>
      </div>
    )
  }

  // ---- Edit: the value box opens into its editor. ----------------------------
  // A handler is the ONLY gate: if the caller can persist it, the reader can
  // edit it. (Without one the field was typeset above.)
  return (
    <div className={className} style={fill ? FIELD_ROOT_FILL : FIELD_ROOT}>
      {typesetLabel}
      <FieldEditor
        value={value}
        onSave={(next) => onSave?.(next)}
        multiline={multiline}
        placeholder={placeholder}
        ariaLabel={`Edit ${labelText.toLowerCase()}`}
        // `fill` and `prominent` reach the readout through the box's class:
        // the box is a flex row, so stretching it and its child span is all
        // the readout needs to fill.
        className={cn(
          WRITE_CUE,
          EDIT_CUE_HOVER_CLASS,
          fill && 'su-field__fill',
          prominent && 'su-field__prominent'
        )}
      />
    </div>
  )
}

/**
 * Field's edit state: the click-to-edit / commit engine inside the one value
 * box. The border is drawn ONCE: at rest the box (`.su-field__box`) frames
 * the readout; while editing the `Input` / `Textarea` IS the bordered control
 * and the box holds it with no frame of its own, so there is never a
 * box-in-box border. Enter (without Shift, in a textarea) and a blur save;
 * Escape closes and drops the draft.
 */
function FieldEditor({
  value,
  onSave,
  multiline,
  placeholder,
  ariaLabel,
  className,
}: {
  value: string
  onSave: (next: string) => Promise<void> | void
  multiline: boolean
  placeholder: string
  ariaLabel: string
  className: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  function open() {
    setDraft(value)
    setEditing(true)
    setTimeout(() => {
      inputRef.current?.focus()
      areaRef.current?.focus()
    }, 0)
  }

  function cancel() {
    setEditing(false)
    setDraft('')
  }

  async function commit(raw: string) {
    setEditing(false)
    setDraft('')
    await onSave(raw)
  }

  if (!editing) {
    const hasValue = value.trim().length > 0
    return (
      <div className={cn('su-field__box', className)}>
        {/* biome-ignore lint/a11y/useSemanticElements: the readout holds the value as text the print sheet keeps (a <button> is hidden there, see the picker above); role, tab stop and keys make it the control */}
        <span
          role="button"
          tabIndex={0}
          aria-label={ariaLabel}
          onClick={open}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              open()
            }
          }}
          className={cn(
            'su-field__readout su-field__readout--editable',
            !hasValue && 'su-field__readout--empty',
            INPUT_FOCUS
          )}
          style={hasValue ? READOUT : READOUT_EMPTY}
        >
          {hasValue ? value : placeholder}
        </span>
      </div>
    )
  }

  return (
    <div className={className} style={FULL_WIDTH}>
      {multiline ? (
        <Textarea
          ref={areaRef}
          value={draft}
          rows={3}
          aria-label={ariaLabel}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => void commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void commit(draft)
            } else if (e.key === 'Escape') {
              e.preventDefault()
              cancel()
            }
          }}
          style={NO_RESIZE}
        />
      ) : (
        <Input
          ref={inputRef}
          value={draft}
          aria-label={ariaLabel}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => void commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void commit(draft)
            } else if (e.key === 'Escape') {
              e.preventDefault()
              cancel()
            }
          }}
        />
      )}
    </div>
  )
}

// `Input` and `Textarea` live in the leaf module `./inputs`, not here: the reference site's
// SSR pass evaluates this source under Bun with no bundler, where an import
// cycle is TDZ-sensitive and evaluation-order dependent, and a leaf keeps
// every importer of them out of one.

type SelectProps = ComponentPropsWithRef<'select'> & {
  /**
   * Faux-select rung: strip the native disclosure (`appearance: none`) and draw a
   * consistent ink chevron inside the field. This is the one sanctioned way to
   * customise the affordance — a caller that wants the styled arrow opts in here
   * rather than re-typing the skin with its own absolute-positioned glyph.
   */
  chevron?: boolean
}

const CHEVRON_WRAP = { display: 'inline-block', position: 'relative' } satisfies CSSProperties

const CHEVRON = {
  color: color.wkMuted,
  pointerEvents: 'none',
  position: 'absolute',
  right: space[12],
  top: '50%',
  translate: '0 -50%',
} satisfies CSSProperties

/**
 * Native `<select>` in the `Input` skin (design-spec §2.5): the app's
 * hand-copied `SELECT_CLASS` promoted to a real atom — same paper / 1.5px-ink /
 * 3px-radius / focus-ring chrome as `Input`, `Field`-wrappable, keeping the
 * native disclosure affordance. Its skin is `.su-text-input` + `.su-select`, all of
 * it a class, so compact call-sites can override the padding via `className`;
 * `chevron` swaps the native arrow for the styled faux-select one.
 */
export function Select({ className, chevron = false, ref, ...props }: SelectProps) {
  const select = (
    <select
      ref={ref}
      className={cn(
        'su-text-input su-select',
        INPUT_FOCUS,
        chevron && 'su-select--chevron',
        className
      )}
      {...props}
    />
  )
  if (!chevron) return select
  return (
    <span style={CHEVRON_WRAP}>
      {select}
      <ChevronDown aria-hidden="true" size={iconSize.compact} style={CHEVRON} />
    </span>
  )
}
