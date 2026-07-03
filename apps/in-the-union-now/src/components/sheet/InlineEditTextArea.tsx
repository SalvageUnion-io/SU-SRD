/**
 * InlineEditTextArea — click-to-edit multi-line text field (Slice F, #239).
 *
 * Mirrors InlineEditField but renders a <textarea> for longer freeform text
 * (e.g. a crawler bay NPC's description). Click → textarea pre-populated with
 * the current value; Enter (without Shift) or blur commits; Esc cancels.
 *
 * Empty values render a muted placeholder so the field is still clickable.
 * When readOnly is true, no click affordance — renders as plain text (or the
 * placeholder, styled muted) only.
 *
 * Dep-injectable for tests: pass onSave as a stub; no module mocking needed.
 */

import { useRef, useState } from 'react'

import { cn } from '../../lib/utils'

type InlineEditTextAreaProps = {
  value: string
  onSave: (next: string) => Promise<void> | void
  ariaLabel: string
  placeholder?: string
  readOnly?: boolean
}

export function InlineEditTextArea({
  value,
  onSave,
  ariaLabel,
  placeholder = 'Add a description…',
  readOnly = false,
}: InlineEditTextAreaProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function startEdit() {
    if (readOnly) return
    setDraft(value)
    setEditing(true)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  function cancel() {
    setEditing(false)
    setDraft('')
  }

  async function commit(raw: string) {
    setEditing(false)
    setDraft('')
    if (raw === value) return
    await onSave(raw)
  }

  if (!editing) {
    const hasValue = value.trim().length > 0
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
          'block min-h-9 whitespace-pre-wrap rounded px-1.5 py-1 font-mono text-sm',
          hasValue ? 'text-ink' : 'text-wk-muted italic',
          !readOnly &&
            'cursor-pointer hover:bg-su-paper focus:outline-none focus:ring-2 focus:ring-su-orange'
        )}
      >
        {hasValue ? value : placeholder}
      </span>
    )
  }

  return (
    <textarea
      ref={textareaRef}
      value={draft}
      aria-label={ariaLabel}
      rows={3}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        void commit(e.target.value)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          void commit(draft)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          cancel()
        }
      }}
      className="w-full rounded border-chrome border-ink bg-su-paper px-1.5 py-1 font-mono text-sm text-ink focus:outline-none focus:ring-2 focus:ring-su-orange"
    />
  )
}
