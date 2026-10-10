import type { ComponentPropsWithRef, CSSProperties, ReactNode } from 'react'
import { color, font, fontSize, space, tracking, weight } from '../../design/tokens'
import { cn } from '../../utils/cn'
import { EDIT_CUE_HOVER_CLASS } from '../shared/editLanguage'
import { Badge } from './Badge'
import { InlineEditField } from './InlineEditField'
import { INPUT_FOCUS } from './interaction'
import { STAMP_SEAM } from './stampSeam'

type FieldCommon = {
  /** Uppercase cond label — the ink Stamp straddling the control's top border. */
  label: ReactNode
  /** Required asterisk inside the label stamp (white on ink). */
  required?: boolean
  /**
   * Optional control riding the top-RIGHT border seam, opposite the label
   * stamp — a mirror plate for a once-per-Downtime USED chip or a d20 Roll
   * assist button (the identity rows' old label-row action).
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
 * `value` inside an ink-bordered value box under the same straddling stamp.
 * ALWAYS editable when it is given a handler — there is no section Edit toggle
 * to unlock first. The value box is DASHED: on a sheet, dashed borders and
 * steppers are the only "write here" cues (ruleset §1, Live Sheet; issue 1255),
 * and the Read | Edit toggle means a sheet only draws them while it is in Edit.
 * The deep-tone outline still comes on hover / focus to mark the one in hand.
 *
 * With NO handler it is the read state, and the read state is typeset, not a
 * form (brand refresh P4, board 10: "print reads, pencil writes"): a small caps
 * label over the value, no box, and nothing at all when the value is empty.
 */
type FieldEditableProps = FieldCommon & {
  /** Current stored value. */
  value: string
  /** Persist a freetext value — enables edit-in-place via `InlineEditField`. */
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

/** Typeset read state: the label, set small over its value. */
const TYPESET_LABEL = {
  alignItems: 'center',
  color: color.ink75,
  display: 'flex',
  fontFamily: font.cond,
  fontSize: fontSize.badge,
  fontWeight: weight.bold,
  gap: space[8],
  letterSpacing: tracking.caps,
  lineHeight: 1.2,
  textTransform: 'uppercase',
} satisfies CSSProperties

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

/** The ink `Input` skin as a value-box shell (paper bg, 1.5px ink border, 3px radius). */
const FIELD_BOX =
  'flex min-h-11 w-full items-center rounded-card border-chrome border-ink bg-paper px-3 font-body text-sm text-ink'

/** A writable value box is pencil, not print: its border is dashed (ruleset §1). */
const WRITE_CUE = 'border-dashed'

/**
 * Form field block (design-spec §2.5 `.field`) — the ONE labelled control. The
 * label IS the ink Stamp straddling the control's top border (StampSeam), the
 * required mark riding inside it (white on ink). Three shapes share that stamp:
 *
 * 1. **static** — caller passes `children` (an `Input`/`Textarea`/`Select`); the
 *    child owns the border the stamp rides. Used by the pilot/mech wizard steps.
 * 2. **edit-in-place** — `value` + `onSave`: an `InlineEditField` engine inside
 *    a bordered value box; the dashed `EDIT_CUE_HOVER_CLASS` signals editability.
 * 3. **picker** — `value` + `onEditClick`: a button value box opening a modal.
 *
 * Shapes 2–3 are the absorbed `IdentityField`: the sheet identity rows lose the
 * old label-tab + pen framing and gain the canonical straddling stamp.
 *
 * 4. **typeset** — `value` with neither handler: the read state. Label over
 *    value, no box, no placeholder; an empty value renders nothing, so a read
 *    sheet omits what was never filled in.
 */
export function Field(props: FieldProps) {
  const { label, required = false, labelAction, className } = props

  const stampBadge = (
    <Badge shape="stamp" size="mini">
      {label}
      {required && (
        <span aria-hidden="true" className="ml-0.5">
          *
        </span>
      )}
    </Badge>
  )
  // The action mirrors the stamp on the opposite seam — same border-riding plate.
  const action = labelAction ? (
    <span className={cn(STAMP_SEAM, 'right-2 flex items-center')}>{labelAction}</span>
  ) : null

  // ---- Static: the label wires to a caller-supplied control. -----------------
  if ('children' in props) {
    return (
      <div className={cn('relative block', className)}>
        <label htmlFor={props.htmlFor} className={cn(STAMP_SEAM, 'left-2 flex w-fit items-center')}>
          {stampBadge}
        </label>
        {action}
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
  } = props
  const labelText = ariaLabel ?? (typeof label === 'string' ? label : '')

  // ---- Typeset: the read state. Nothing to write, so nothing that looks like
  // a form: the label over the value, and no row at all for an empty one. ------
  if (onSave === undefined && onEditClick === undefined) {
    if (value.trim() === '') return null
    return (
      <div className={className}>
        <div style={TYPESET_LABEL}>
          {label}
          {labelAction}
        </div>
        <p style={prominent ? TYPESET_PROMINENT : multiline ? TYPESET_PROSE : TYPESET_VALUE}>
          {value}
        </p>
      </div>
    )
  }

  const stamp = (
    <span className={cn(STAMP_SEAM, 'left-2 flex w-fit items-center')}>{stampBadge}</span>
  )
  const valueSpan = (
    <span className={cn('min-w-0 flex-1 truncate', value ? 'font-medium' : 'text-wk-muted')}>
      {value || placeholder}
    </span>
  )

  // ---- Picker: a value box that opens a modal. -------------------------------
  if (onEditClick) {
    return (
      <div className={cn('relative block', className)}>
        {stamp}
        {action}
        <button
          type="button"
          aria-label={`Change ${labelText.toLowerCase()}`}
          onClick={onEditClick}
          // The VALUE lives inside this button, not beside it, so the print
          // stylesheets' `button:not([data-print='keep'])` rule took the
          // field's content along with its affordance: a printed sheet lost
          // the pilot's class, the mech's chassis and the crawler's type —
          // each surface's single most identifying field — while every other
          // field printed, because `InlineEditField` renders a
          // `<span role="button">` that the element selector never matched.
          // This is the case the hatch was written for; it is shared verbatim
          // by both apps' print CSS, so the opt-in belongs on the markup.
          // A read-only Field is typeset, with no button to hide.
          data-print="keep"
          className={cn(
            FIELD_BOX,
            WRITE_CUE,
            'cursor-pointer text-left hover:bg-ink-8',
            EDIT_CUE_HOVER_CLASS
          )}
        >
          {valueSpan}
        </button>
      </div>
    )
  }

  // ---- Edit-in-place: the InlineEditField engine inside the value box. --------
  // A handler is the ONLY gate: if the caller can persist it, the reader can
  // edit it. (Without one the field was typeset above.)
  return (
    <div className={cn('relative block', fill && 'flex h-full flex-col', className)}>
      {stamp}
      {action}
      <InlineEditField
        bordered
        value={value}
        onSave={(next) => onSave?.(String(next))}
        multiline={multiline}
        placeholder={placeholder}
        ariaLabel={`Edit ${labelText.toLowerCase()}`}
        // `fill` reaches the readout through the box's own class hook rather
        // than a new InlineEditField prop: the box is a flex row, so stretching
        // it and its child span is all the readout needs to fill.
        className={cn(
          WRITE_CUE,
          EDIT_CUE_HOVER_CLASS,
          fill &&
            'h-full flex-1 items-stretch [&>span]:h-full [&>span]:items-start [&>span]:py-2.5',
          // Reaches the readout through the box's class hook, like `fill`.
          prominent && '[&>span]:text-xl'
        )}
      />
    </div>
  )
}

// `Input` and `Textarea` now live in the leaf module `./inputs`, and are
// re-exported here so every existing import path still resolves.
//
// They moved to break a two-node runtime import cycle: this file imports
// `InlineEditField`, which imported `Input`/`Textarea` back from here. srd's SSR
// pass evaluates this source under Bun with no bundler, where a cycle is
// TDZ-sensitive and evaluation-order dependent.
export { Input, Textarea } from './inputs'

type SelectProps = ComponentPropsWithRef<'select'> & {
  /**
   * Faux-select rung: strip the native disclosure (`appearance-none`) and draw a
   * consistent ink chevron inside the field. This is the one sanctioned way to
   * customise the affordance — a caller that wants the styled arrow opts in here
   * rather than re-typing the skin with its own absolute-positioned glyph.
   */
  chevron?: boolean
}

/**
 * Native `<select>` in the `Input` skin (design-spec §2.5): the app's
 * hand-copied `SELECT_CLASS` promoted to a real atom — same paper / 1.5px-ink /
 * 3px-radius / focus-ring chrome as `Input`, `Field`-wrappable, keeping the
 * native disclosure affordance. Compact call-sites pass `px-2 py-1.5` via
 * `className`; `chevron` swaps the native arrow for the styled faux-select one.
 */
export function Select({ className, chevron = false, ref, ...props }: SelectProps) {
  const select = (
    <select
      ref={ref}
      className={cn(
        'w-full min-h-11 rounded-card border-chrome border-ink bg-paper px-3 py-2.5 font-body text-sm text-ink',
        INPUT_FOCUS,
        chevron && 'cursor-pointer appearance-none pr-8',
        className
      )}
      {...props}
    />
  )
  if (!chevron) return select
  return (
    <span className="relative inline-block">
      {select}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-wk-muted"
      >
        ▾
      </span>
    </span>
  )
}
