import type { CSSProperties } from 'react'
import { useRef, useState } from 'react'
import { font, radius, size, space, weight } from '../../design/tokens'
import { cn } from '../../lib/cn'
import { FieldError } from './FieldError'
import { Input, Textarea } from './inputs'
import { INPUT_FOCUS } from './interaction'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InlineEditFieldProps = {
  /** Current stored value (bold display text until clicked to edit). */
  value: string | number
  /** Persist a new value; awaited before returning to display. */
  onSave: (next: string | number) => Promise<void> | void
  /** `number` validates the number (and `max`) and shows an inline error; default `text`. */
  type?: 'number' | 'text'
  max?: number
  /** 3-row textarea instead of a single-line input (Enter without Shift commits). */
  multiline?: boolean
  /**
   * Frame the control as a full-width, ink-bordered value box (paper bg,
   * `Input` skin) instead of inline text. This is the shape `Field` wraps its
   * straddling stamp around for the sheet identity rows: the border is drawn
   * ONCE (on the display box, or on the edit `Input` that replaces it), so
   * there is never a box-in-box border. Plain (unset) stays inline editable
   * text for stat/name cells.
   */
  bordered?: boolean
  placeholder?: string
  /** Strip the edit affordance — renders as plain text only. */
  readOnly?: boolean
  ariaLabel?: string
  className?: string
}

const ERROR_SKIN = 'su-inline-edit__error'

/**
 * The readout — the tap target that opens the editor, so it keeps a 44px
 * minimum in BOTH layouts. Its alignment and colour are `.su-inline-edit__readout`'s
 * (callers and `Field` restyle them through the box).
 * font-medium, not bold: a sheet is mostly filled-in fields, and at bold every
 * value competed with the ink stamps labelling it.
 */
const READOUT = {
  display: 'inline-flex',
  fontFamily: font.body,
  fontWeight: weight.medium,
  minHeight: size.full,
} satisfies CSSProperties

/** The wrapper of the plain (inline) shape: the same 44px minimum. */
const PLAIN_WRAP = { display: 'inline-flex', minHeight: size.full } satisfies CSSProperties

const SINGLE_LINE_EDITOR = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[4],
  width: '100%',
} satisfies CSSProperties

const FULL_WIDTH = { width: '100%' } satisfies CSSProperties

const NO_RESIZE = { resize: 'none' } satisfies CSSProperties

// ---------------------------------------------------------------------------
// Component — the pure edit-in-place engine. Labelling + the straddling stamp
// live in `Field`; this atom owns only the click-to-edit / validate / commit
// behaviour and (optionally, via `bordered`) the single value-box frame.
// ---------------------------------------------------------------------------

export function InlineEditField({
  value,
  onSave,
  type = 'text',
  max,
  multiline = false,
  bordered = false,
  placeholder,
  readOnly = false,
  ariaLabel,
  className,
}: InlineEditFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  function startEdit() {
    if (readOnly) return
    setDraft(String(value))
    setError(null)
    setEditing(true)
    setTimeout(() => {
      inputRef.current?.focus()
      areaRef.current?.focus()
    }, 0)
  }

  function cancel() {
    setEditing(false)
    setDraft('')
    setError(null)
  }

  function validate(
    raw: string
  ): { ok: true; parsed: string | number } | { ok: false; msg: string } {
    if (type === 'number') {
      const trimmed = raw.trim()
      const parsed = Number(trimmed)
      if (trimmed === '' || !Number.isFinite(parsed)) {
        return { ok: false, msg: 'Must be a number.' }
      }
      if (max !== undefined && parsed > max) {
        return { ok: false, msg: `max ${max}` }
      }
      return { ok: true, parsed }
    }
    return { ok: true, parsed: raw }
  }

  async function commit(raw: string) {
    const result = validate(raw)
    if (!result.ok) {
      setError(result.msg)
      return
    }
    setError(null)
    setEditing(false)
    setDraft('')
    await onSave(result.parsed)
  }

  // -------------------------------------------------------------------------
  // Inner node (display readout, or the active editor)
  // -------------------------------------------------------------------------

  let inner: React.ReactNode

  if (!editing) {
    const hasValue = String(value).trim().length > 0
    inner = (
      // biome-ignore lint/a11y/noStaticElementInteractions: role/tabIndex/handlers apply together as an editable set; readOnly strips them all — the rule can't see through the conditional
      // biome-ignore lint/a11y/useAriaPropsSupportedByRole: readOnly renders a plain value readout whose aria-label consumers (and tests) still rely on
      <span
        role={readOnly ? undefined : 'button'}
        tabIndex={readOnly ? undefined : 0}
        aria-label={ariaLabel}
        onClick={readOnly ? undefined : startEdit}
        onKeyDown={
          readOnly
            ? undefined
            : (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  startEdit()
                }
              }
        }
        className={cn(
          'su-inline-edit__readout',
          !hasValue && 'su-inline-edit__readout--empty',
          !readOnly && cn('su-inline-edit__readout--editable', INPUT_FOCUS)
        )}
        style={{
          ...READOUT,
          ...(!hasValue && { fontWeight: weight.normal }),
          // Bordered mode fills its value box; plain mode stays inline.
          ...(bordered
            ? { borderRadius: radius.card, paddingInline: space[12], width: '100%' }
            : !readOnly && { borderRadius: radius.card, paddingInline: space[4] }),
          ...(!readOnly && { cursor: 'pointer' }),
        }}
      >
        {hasValue ? value : (placeholder ?? '—')}
      </span>
    )
  } else if (multiline) {
    inner = (
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
    )
  } else {
    // Single-line editor — reuses Field's Input skin (paper / ink border / focus ring).
    inner = (
      <span style={SINGLE_LINE_EDITOR}>
        <Input
          ref={inputRef}
          type={type}
          numeric={type === 'number'}
          value={draft}
          max={max}
          aria-label={ariaLabel}
          aria-invalid={error !== null}
          placeholder={placeholder}
          onChange={(e) => {
            setDraft(e.target.value)
            if (error) setError(null)
          }}
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
          className={cn(error && ERROR_SKIN)}
        />
        <FieldError>{error}</FieldError>
      </span>
    )
  }

  // -------------------------------------------------------------------------
  // Plain (inline text) — the stat / name-cell shape, unchanged
  // -------------------------------------------------------------------------

  if (!bordered) {
    // The wrapper carries the same 44px minimum as the display state it holds,
    // so an unlabelled field is a full touch target from the outside too.
    return (
      <span className={className} style={PLAIN_WRAP}>
        {inner}
      </span>
    )
  }

  // -------------------------------------------------------------------------
  // Bordered value box — the border is drawn once. While editing, the `Input`
  // / `Textarea` IS the full-width bordered control, so the box just holds it
  // (no second border); at rest, the box supplies the frame around the readout.
  // `className` (e.g. `Field`'s dashed edit cue) frames the box in both states.
  // -------------------------------------------------------------------------

  if (editing) {
    return (
      <div className={className} style={FULL_WIDTH}>
        {inner}
      </div>
    )
  }

  return <div className={cn('su-inline-edit__box', className)}>{inner}</div>
}
