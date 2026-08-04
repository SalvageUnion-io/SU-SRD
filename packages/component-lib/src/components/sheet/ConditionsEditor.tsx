/**
 * ConditionsEditor — editable conditions block for the pilot live sheet (W2-3, #254).
 *
 * Composes the canonical `Conditions` chip row (chrome/Conditions — Badge-built
 * warn chips with × remove + the dashed '+ Add' affordance) inside the sheet's
 * bordered well, adding what an editor needs on top: the "None" empty state and
 * the inline text input that commits a new freeform condition. There is no
 * canonical pilot-condition enum in salvageunion-reference, so conditions are
 * freeform strings entered via that input (design board-screens.jsx).
 *
 * Persistence: onChange receives the next conditions array. Callers wire this to
 * store.update reading the freshest map from the store to avoid stale-closure
 * stomps (see PilotSheet.handleConditionsChange).
 *
 * readOnly: suppresses both the remove control on each chip and the "+ Add"
 * affordance — chips render as plain badges (published snapshots).
 */

import { Conditions } from '../chrome/Conditions'
import { INPUT_FOCUS } from '../chrome/interaction'
import { cn } from '../../utils/cn'
import { useChipDraft } from './useChipDraft'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConditionsEditorProps = {
  conditions: ReadonlyArray<string>
  onChange: (next: string[]) => Promise<void> | void
  readOnly?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConditionsEditor({
  conditions,
  onChange,
  readOnly = false,
}: ConditionsEditorProps) {
  const draft = useChipDraft({
    disabled: readOnly,
    onCommit: async (value) => {
      // Skip case-insensitive duplicates; conditions are a flat string set.
      const exists = conditions.some((c) => c.trim().toLowerCase() === value.toLowerCase())
      if (!exists) {
        await onChange([...conditions, value])
      }
    },
  })

  /** Remove the first occurrence — identical strings are indistinguishable. */
  async function remove(condition: string) {
    if (readOnly) return
    const index = conditions.indexOf(condition)
    if (index < 0) return
    await onChange(conditions.filter((_, i) => i !== index))
  }

  return (
    <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded border-chrome border-ink bg-paper p-2.5">
      {conditions.length === 0 && !draft.adding && (
        <span className="font-body text-xs text-wk-muted">None</span>
      )}

      {/* Only rendered when it has chips or the '+ Add' affordance to show —
          an empty row would still count as a flex item and double the gap. */}
      {(conditions.length > 0 || (!readOnly && !draft.adding)) && (
        <Conditions
          conditions={[...conditions]}
          onRemove={readOnly ? undefined : (condition) => void remove(condition)}
          onAdd={readOnly || draft.adding ? undefined : draft.startAdd}
        />
      )}

      {!readOnly && draft.adding && (
        <input
          {...draft.inputProps}
          aria-label="New condition"
          className={cn(
            'w-28 rounded-badge border border-ink bg-paper px-1.5 py-0.5 font-cond text-badge uppercase tracking-caps text-ink',
            INPUT_FOCUS
          )}
        />
      )}
    </div>
  )
}
