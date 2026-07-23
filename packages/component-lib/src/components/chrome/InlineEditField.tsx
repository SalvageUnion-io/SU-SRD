import { useRef, useState } from 'react'
import { cn } from '../../utils/cn'
import { INPUT_FOCUS } from './interaction'
import { Input, Textarea } from './Field'
import { FieldError } from './FieldError'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InlineEditFieldProps = {
  /** Current stored value (bold display text until clicked to edit). */
  value: string | number
  /** Persist a new value; awaited before returning to display. */
  onSave: (next: string | number) => Promise<void> | void
  /** `number` validates min/max and shows an inline error; default `text`. */
  type?: 'number' | 'text'
  min?: number
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

const ERROR_SKIN = 'border-status-bad focus:ring-status-bad/25'

// ---------------------------------------------------------------------------
// Component — the pure edit-in-place engine. Labelling + the straddling stamp
// live in `Field`; this atom owns only the click-to-edit / validate / commit
// behaviour and (optionally, via `bordered`) the single value-box frame.
// ---------------------------------------------------------------------------

export function InlineEditField({
  value,
  onSave,
  type = 'text',
  min,
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
      if (min !== undefined && parsed < min) {
        return { ok: false, msg: `min ${min}` }
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
          // The display state is the tap target that opens the editor, so it
          // keeps a 44px minimum in BOTH layouts — dropping to min-h-9 would
          // have silently shrunk it below the touch target.
          'inline-flex min-h-11 items-center font-body font-bold text-ink',
          // Bordered mode fills its value box; plain mode stays inline.
          bordered && 'w-full rounded-card px-3',
          !hasValue && 'font-normal text-wk-muted',
          !readOnly &&
            cn('cursor-pointer hover:bg-ink-8', INPUT_FOCUS, !bordered && 'rounded-card px-1')
        )}
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
        className="resize-none"
      />
    )
  } else {
    // Single-line editor — reuses Field's Input skin (paper / ink border / rust ring).
    inner = (
      <span className="flex w-full flex-col gap-1">
        <Input
          ref={inputRef}
          type={type}
          value={draft}
          min={min}
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
    return <span className={cn('inline-flex min-h-11', className)}>{inner}</span>
  }

  // -------------------------------------------------------------------------
  // Bordered value box — the border is drawn once. While editing, the `Input`
  // / `Textarea` IS the full-width bordered control, so the box just holds it
  // (no second border); at rest, the box supplies the frame around the readout.
  // `className` (e.g. `Field`'s dashed edit cue) frames the box in both states.
  // -------------------------------------------------------------------------

  if (editing) {
    return <div className={cn('w-full', className)}>{inner}</div>
  }

  return (
    <div
      className={cn(
        'flex min-h-11 w-full items-center rounded-card border-chrome border-ink bg-paper',
        className
      )}
    >
      {inner}
    </div>
  )
}
