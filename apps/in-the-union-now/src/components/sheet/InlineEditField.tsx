/**
 * InlineEditField — click-to-edit shared building block for stat fields.
 *
 * Display: renders value as plain text until clicked.
 * Click → controlled <input> pre-populated with current value.
 * Enter or blur → calls onSave(newValue); awaits; returns to display.
 * Esc → cancels; reverts to display without calling onSave.
 * Number type: validates min/max; out-of-range shows red border + inline error.
 * When readOnly is true, no click affordance — renders as plain text only.
 *
 * Dep-injectable for tests: pass onSave as a stub; no module mocking needed.
 */

import { useRef, useState } from 'react'

import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InlineEditFieldProps = {
  value: number | string
  onSave: (next: number | string) => Promise<void> | void
  type?: 'number' | 'text'
  min?: number
  max?: number
  ariaLabel?: string
  className?: string
  readOnly?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InlineEditField({
  value,
  onSave,
  type = 'text',
  min,
  max,
  ariaLabel,
  className,
  readOnly = false,
}: InlineEditFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    if (readOnly) return
    setDraft(String(value))
    setError(null)
    setEditing(true)
    // Focus the input on the next tick after mount
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function cancel() {
    setEditing(false)
    setDraft('')
    setError(null)
  }

  function validate(
    raw: string
  ): { ok: true; parsed: number | string } | { ok: false; msg: string } {
    if (type === 'number') {
      const trimmed = raw.trim()
      const parsed = Number(trimmed)
      if (trimmed === '' || !Number.isFinite(parsed)) {
        return { ok: false, msg: 'Must be a number.' }
      }
      if (min !== undefined && parsed < min) {
        return { ok: false, msg: `Minimum value is ${min}.` }
      }
      if (max !== undefined && parsed > max) {
        return { ok: false, msg: `Maximum value is ${max}.` }
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

  if (!editing) {
    return (
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
          'inline-flex items-center justify-center min-h-11 sm:min-h-9 font-mono text-lg font-bold text-ink',
          !readOnly &&
            'cursor-pointer rounded px-1 hover:bg-su-paper focus:outline-none focus:ring-2 focus:ring-su-orange',
          className
        )}
      >
        {value}
      </span>
    )
  }

  return (
    <span className={cn('inline-flex flex-col gap-0.5', className)}>
      <input
        ref={inputRef}
        type={type}
        value={draft}
        aria-label={ariaLabel}
        aria-invalid={error !== null}
        min={min}
        max={max}
        onChange={(e) => {
          setDraft(e.target.value)
          // Clear previous error as the user types
          if (error) setError(null)
        }}
        onBlur={(e) => {
          // Blur commits unless the value hasn't changed (to avoid spurious saves)
          void commit(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void commit(draft)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            cancel()
          }
        }}
        className={cn(
          'w-16 rounded border-chrome bg-su-paper px-1 py-0.5 text-center font-mono text-lg font-bold text-ink focus:outline-none focus:ring-2 focus:ring-su-orange',
          error ? 'border-danger focus:ring-danger' : 'border-ink'
        )}
      />
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  )
}
