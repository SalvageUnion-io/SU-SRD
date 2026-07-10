/**
 * ConditionsEditor — editable conditions block for the pilot live sheet (W2-3, #254).
 *
 * Renders active conditions as removable chips plus a "+ Add" affordance. There is
 * no canonical pilot-condition enum in salvageunion-reference, so conditions are
 * freeform strings entered via a small inline text input (design board-screens.jsx).
 *
 * Persistence: onChange receives the next conditions array. Callers wire this to
 * store.update reading the freshest map from the store to avoid stale-closure
 * stomps (see PilotSheet.handleConditionsChange).
 *
 * readOnly: suppresses both the remove control on each chip and the "+ Add"
 * affordance — chips render as plain badges (published snapshots).
 */

import { useRef, useState } from 'react'

import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConditionsEditorProps = {
  conditions: ReadonlyArray<string>
  onChange: (next: string[]) => Promise<void> | void
  readOnly?: boolean
}

// ---------------------------------------------------------------------------
// Severity styling
// ---------------------------------------------------------------------------

/**
 * Conditions that carry a warn/severity tone in the design (amber "Exposed").
 * Compared case-insensitively. Anything not listed gets the neutral chip.
 */
const WARN_CONDITIONS = new Set(['exposed'])

function chipToneClasses(condition: string): string {
  if (WARN_CONDITIONS.has(condition.trim().toLowerCase())) {
    return 'bg-su-sickly-yellow text-ink'
  }
  // text-su-ink-soft (not wk-muted) on blue-pale: wk-muted is ~3.96:1 here,
  // below WCAG AA 4.5:1 for this 11px chip text; su-ink-soft is ~9.2:1.
  return 'bg-su-blue-pale text-su-ink-soft'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConditionsEditor({
  conditions,
  onChange,
  readOnly = false,
}: ConditionsEditorProps) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function startAdd() {
    if (readOnly) return
    setDraft('')
    setAdding(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function cancelAdd() {
    setAdding(false)
    setDraft('')
  }

  async function commitAdd() {
    const value = draft.trim()
    if (!value) {
      cancelAdd()
      return
    }
    // Skip case-insensitive duplicates; conditions are a flat string set.
    const exists = conditions.some((c) => c.trim().toLowerCase() === value.toLowerCase())
    if (!exists) {
      await onChange([...conditions, value])
    }
    cancelAdd()
  }

  async function removeAt(index: number) {
    if (readOnly) return
    await onChange(conditions.filter((_, i) => i !== index))
  }

  const chipBase =
    'inline-flex items-center gap-1 rounded-[2px] px-2 py-0.5 font-cond text-badge font-semibold uppercase tracking-wider'

  return (
    <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded border-chrome border-ink bg-su-paper p-2.5">
      {conditions.length === 0 && !adding && (
        <span className="font-mono text-xs text-wk-muted">None</span>
      )}

      {conditions.map((condition, index) =>
        readOnly ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: conditions are free-form strings that may repeat; value+index is the most stable key available and chips hold no state
          <span key={`${condition}-${index}`} className={cn(chipBase, chipToneClasses(condition))}>
            {condition}
          </span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: conditions are free-form strings that may repeat; value+index is the most stable key available and chips hold no state
          <span key={`${condition}-${index}`} className={cn(chipBase, chipToneClasses(condition))}>
            {condition}
            <button
              type="button"
              aria-label={`Remove condition ${condition}`}
              onClick={() => {
                void removeAt(index)
              }}
              className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[1px] leading-none hover:bg-ink/10"
            >
              <span aria-hidden className="text-[12px]">
                ×
              </span>
            </button>
          </span>
        )
      )}

      {!readOnly &&
        (adding ? (
          <input
            ref={inputRef}
            type="text"
            value={draft}
            aria-label="New condition"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void commitAdd()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                cancelAdd()
              }
            }}
            onBlur={() => {
              void commitAdd()
            }}
            className="w-28 rounded-[2px] border border-ink bg-su-white px-1.5 py-0.5 font-cond text-badge uppercase tracking-wider text-ink focus:outline-none focus:ring-1 focus:ring-su-orange"
          />
        ) : (
          <button
            type="button"
            aria-label="Add condition"
            onClick={startAdd}
            className={cn(
              chipBase,
              'border border-dashed border-ink/40 bg-transparent text-wk-muted hover:border-ink hover:text-ink'
            )}
          >
            + Add
          </button>
        ))}
    </div>
  )
}
