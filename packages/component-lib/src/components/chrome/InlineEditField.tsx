import { useRef, useState } from 'react'
import { Glyph } from './glyphs'
import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { Input } from './Field'
import { Badge } from './Badge'
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
   * Optional uppercase label. When set, renders the IdentityField look: a small
   * black label tab ~2px above a tone-bordered value box with a pinned pen.
   */
  label?: string
  /**
   * Optional control rendered on the label row, opposite the label stamp (e.g.
   * a roll-assist `Button`). Only shown in the labeled (`label` set) layout.
   */
  labelAction?: ReactNode
  placeholder?: string
  /** Strip the edit affordance — renders as plain text only. */
  readOnly?: boolean
  ariaLabel?: string
  className?: string
}

// ---------------------------------------------------------------------------
// Pen glyph — pinned inside the labeled value box (design-spec `.ifield .pen`)
// ---------------------------------------------------------------------------

// Shared input skin, mirroring Field's Input focus-ring pattern (ring-rust/25,
// paper bg, 1.5px ink border, 3px radius) so the textarea matches the input.
const CONTROL_SKIN =
  'w-full rounded-card border-chrome border-ink bg-paper px-3 py-2 font-body text-sm text-ink placeholder:text-wk-faint focus:outline-none focus:ring-[3px] focus:ring-rust/25'

const ERROR_SKIN = 'border-danger focus:ring-danger/25'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InlineEditField({
  value,
  onSave,
  type = 'text',
  min,
  max,
  multiline = false,
  label,
  labelAction,
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

  const fieldLabel = ariaLabel ?? label
  const boxed = label !== undefined

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
  // Display (not editing)
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
        aria-label={fieldLabel}
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
          // keeps a 44px minimum in BOTH layouts — the sheet variant this
          // component absorbed guaranteed that, and dropping to min-h-9 when
          // not `boxed` would have silently shrunk it below the touch target.
          'inline-flex min-h-11 items-center font-body font-bold text-ink',
          boxed && 'w-full pr-6',
          !hasValue && 'font-normal text-wk-muted',
          !readOnly &&
            'cursor-pointer rounded-card px-1 hover:bg-wk-bg-2 focus:outline-none focus:ring-[3px] focus:ring-rust/25'
        )}
      >
        {hasValue ? value : (placeholder ?? '—')}
      </span>
    )
  } else if (multiline) {
    // -----------------------------------------------------------------------
    // Edit — multiline textarea
    // -----------------------------------------------------------------------
    inner = (
      <textarea
        ref={areaRef}
        value={draft}
        rows={3}
        aria-label={fieldLabel}
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
        className={cn(CONTROL_SKIN, 'resize-none')}
      />
    )
  } else {
    // -----------------------------------------------------------------------
    // Edit — single-line input (reuses Field's Input skin + focus ring)
    // -----------------------------------------------------------------------
    inner = (
      <span className="flex w-full flex-col gap-1">
        <Input
          ref={inputRef}
          type={type}
          value={draft}
          min={min}
          max={max}
          aria-label={fieldLabel}
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
  // Plain (no label): return the inner node directly
  // -------------------------------------------------------------------------

  if (!boxed) {
    // The wrapper carries the same 44px minimum as the display state it holds,
    // so an unlabelled field is a full touch target from the outside too.
    return <span className={cn('inline-flex min-h-11', className)}>{inner}</span>
  }

  // -------------------------------------------------------------------------
  // Labeled (IdentityField look): label tab ~2px above a tone-bordered box
  // -------------------------------------------------------------------------

  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      {labelAction ? (
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <Badge shape="stamp" size="sm">
            {label}
          </Badge>
          {labelAction}
        </div>
      ) : (
        <Badge shape="stamp" size="sm" className="mb-0.5">
          {label}
        </Badge>
      )}
      <span
        className={cn(
          'relative flex min-h-11 items-center rounded-card border-2 bg-paper px-3',
          !readOnly && 'pr-9'
        )}
        style={{ borderColor: 'var(--tone-deep, var(--color-ink))' }}
      >
        {inner}
        {!readOnly && !editing && (
          <Glyph
            name="pencil"
            className="pointer-events-none absolute right-2.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-ink/55"
          />
        )}
      </span>
    </div>
  )
}
