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
 * Compared case-insensitively. Anything not listed gets the neutral ink-fill
 * chip (poster `.cond.on`).
 */
const WARN_CONDITIONS = new Set(['exposed'])

/** Fill/border/text classes for a PRESENT (`.cond.on`) condition chip. */
function chipToneClasses(condition: string): string {
  if (WARN_CONDITIONS.has(condition.trim().toLowerCase())) {
    return 'border-su-sickly-yellow bg-su-sickly-yellow text-ink'
  }
  return 'border-ink bg-ink text-paper'
}

/** The chip's leading dot (poster `.cond .dot` — accent-filled when ON). */
function chipDotClasses(condition: string): string {
  if (WARN_CONDITIONS.has(condition.trim().toLowerCase())) {
    return 'border-ink bg-ink'
  }
  return 'border-[color:var(--tone,var(--color-su-orange))] bg-[var(--tone,var(--color-su-orange))]'
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

  // Poster `.cond` chip shape: 2px border, rounded-[2px], min-h-8, a leading
  // dot, cond-caps text. Present conditions always render the `.cond.on`
  // fill (ink or warn-tone) + accent/ink dot; the "+ Add" affordance below
  // uses the unset shape (solid ink-35 border, no dashed rule).
  const chipBase =
    'inline-flex min-h-8 items-center gap-1.5 rounded-[2px] border-2 px-2.5 py-1.5 font-cond text-[10.5px] font-bold uppercase leading-none tracking-caps'

  return (
    <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded border-chrome border-ink bg-su-paper p-2.5">
      {conditions.length === 0 && !adding && (
        <span className="font-mono text-xs text-wk-muted">None</span>
      )}

      {conditions.map((condition, index) =>
        readOnly ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: conditions are free-form strings that may repeat; value+index is the most stable key available and chips hold no state
          <span key={`${condition}-${index}`} className={cn(chipBase, chipToneClasses(condition))}>
            <span
              aria-hidden="true"
              className={cn(
                'h-[9px] w-[9px] shrink-0 rounded-full border-2',
                chipDotClasses(condition)
              )}
            />
            {condition}
          </span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: conditions are free-form strings that may repeat; value+index is the most stable key available and chips hold no state
          <span key={`${condition}-${index}`} className={cn(chipBase, chipToneClasses(condition))}>
            <span
              aria-hidden="true"
              className={cn(
                'h-[9px] w-[9px] shrink-0 rounded-full border-2',
                chipDotClasses(condition)
              )}
            />
            {condition}
            <button
              type="button"
              aria-label={`Remove condition ${condition}`}
              onClick={() => {
                void removeAt(index)
              }}
              className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[1px] leading-none hover:bg-paper/20"
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
            className="w-28 rounded-[2px] border border-ink bg-paper px-1.5 py-0.5 font-cond text-badge uppercase tracking-caps text-ink focus:outline-none focus:ring-1 focus:ring-su-orange"
          />
        ) : (
          <button
            type="button"
            aria-label="Add condition"
            onClick={startAdd}
            className={cn(
              chipBase,
              'border-ink/35 bg-paper text-ink/55 hover:border-ink hover:text-ink'
            )}
          >
            + Add
          </button>
        ))}
    </div>
  )
}
