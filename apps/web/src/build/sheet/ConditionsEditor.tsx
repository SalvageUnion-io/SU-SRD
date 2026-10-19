/**
 * ConditionsEditor — editable conditions block for the pilot live sheet.
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

import type { CSSProperties } from 'react'
import { Conditions, Input, tokens } from '../../components/index'
import { useChipDraft } from './useChipDraft'

/** The sheet's bordered well around the chip row. */
const WELL = {
  alignItems: 'center',
  backgroundColor: tokens.color.paper,
  border: `${tokens.borderWidth.chrome} solid ${tokens.color.ink}`,
  borderRadius: tokens.radius.card,
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[6],
  minHeight: '3rem',
  padding: tokens.space[10],
} satisfies CSSProperties

const NONE = {
  color: tokens.color.wkMuted,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.xs,
  lineHeight: 'calc(1 / 0.75)',
} satisfies CSSProperties

/** The new-condition field: the Compact `Input` (R16), sized to a chip's word. */
const DRAFT_INPUT = { width: '9rem' } satisfies CSSProperties

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConditionsEditorProps = {
  conditions: ReadonlyArray<string>
  onChange: (next: string[]) => Promise<void> | void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConditionsEditor({ conditions, onChange }: ConditionsEditorProps) {
  const draft = useChipDraft({
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
    const index = conditions.indexOf(condition)
    if (index < 0) return
    await onChange(conditions.filter((_, i) => i !== index))
  }

  return (
    <div style={WELL}>
      {conditions.length === 0 && !draft.adding && <span style={NONE}>None</span>}

      {/* Only rendered when it has chips or the '+ Add' affordance to show —
          an empty row would still count as a flex item and double the gap. */}
      {(conditions.length > 0 || !draft.adding) && (
        <Conditions
          conditions={[...conditions]}
          onRemove={(condition) => void remove(condition)}
          onAdd={draft.adding ? undefined : draft.startAdd}
        />
      )}

      {draft.adding && (
        <Input
          {...draft.inputProps}
          size="compact"
          aria-label="New condition"
          style={DRAFT_INPUT}
        />
      )}
    </div>
  )
}
