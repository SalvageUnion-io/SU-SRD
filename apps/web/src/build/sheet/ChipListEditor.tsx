/**
 * ChipListEditor — the one chip-well editor (ruleset §6.6): a live sheet's
 * editable list of free-form strings, a pilot's or mech's conditions and a
 * bay crew's facts alike. The canonical `Conditions` chip row (each chip's ×,
 * the dashed "+ Add") in the sheet's one well, the inline Compact `Input` that
 * commits a new chip, and the one empty state, `EmptyState` inline (chrome K8,
 * "No <things> yet.").
 *
 * - **The one well:** paper, a 1.5px ink frame, 3px corners, 8px of padding
 *   and 6px between chips (§4.4's scale), tall enough for one Compact line in
 *   that padding (`chipWell.model.ts`). `ChipListEditor.test.tsx` pins it.
 * - **A set or a list:** a set (`unique`, conditions) drops a commit that
 *   repeats one, case aside; a list (facts) keeps a repeat. Either removes by
 *   position.
 * - `noun` names the empty state ("No conditions yet."), and with `owner` the
 *   field and controls ("New Command Bay crew fact"), so several wells on one
 *   page stay distinguishable.
 * - `readOnly` drops the × and the "+ Add": the chips read as plain chips
 *   (a published snapshot).
 *
 * Persistence: `onChange` receives the next list. Callers write it reading the
 * freshest record from the store, never a stale closure.
 */

import { Conditions, EmptyState, Input } from '../../components/index'
import { CHIP_WELL } from './chipWell.model'
import { useChipDraft } from './useChipDraft'

type ChipListEditorProps = {
  items: ReadonlyArray<string>
  onChange: (next: string[]) => Promise<void> | void
  /** What one chip is, singular: "condition", "fact". */
  noun: string
  /** Whose chips they are, before the noun in each label ("Command Bay crew"). */
  owner?: string
  /** The draft field's width: a chip's word (conditions), a short sentence (facts). */
  draftWidth: string
  /** A set: a commit repeating a chip, case aside, is dropped. */
  unique?: boolean
  /** The chips' material: `warn` (conditions, the default) or `quiet` (facts). */
  tone?: 'warn' | 'quiet'
  readOnly?: boolean
}

export function ChipListEditor({
  items,
  onChange,
  noun,
  owner,
  draftWidth,
  unique = false,
  tone,
  readOnly = false,
}: ChipListEditorProps) {
  const subject = owner ? `${owner} ${noun}` : noun
  const draft = useChipDraft({
    disabled: readOnly,
    onCommit: async (value) => {
      const repeat = items.some((item) => item.trim().toLowerCase() === value.toLowerCase())
      if (unique && repeat) return
      await onChange([...items, value])
    },
  })

  /** Remove by position: two chips may read the same. */
  async function removeAt(index: number) {
    if (readOnly) return
    await onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div style={CHIP_WELL} data-chip-well="">
      {items.length === 0 && !draft.adding && (
        <EmptyState variant="inline" body={`No ${noun}s yet.`} />
      )}

      {/* Only rendered when it has chips or the '+ Add' affordance to show —
          an empty row would still count as a flex item and double the gap. */}
      {(items.length > 0 || (!readOnly && !draft.adding)) && (
        <Conditions
          conditions={[...items]}
          tone={tone}
          onRemove={readOnly ? undefined : (_item, index) => void removeAt(index)}
          removeLabel={(item) => `Remove ${subject} ${item}`}
          onAdd={readOnly || draft.adding ? undefined : draft.startAdd}
          addLabel={`Add ${subject}`}
        />
      )}

      {!readOnly && draft.adding && (
        <Input
          {...draft.inputProps}
          size="compact"
          aria-label={`New ${subject}`}
          style={{ width: draftWidth }}
        />
      )}
    </div>
  )
}
