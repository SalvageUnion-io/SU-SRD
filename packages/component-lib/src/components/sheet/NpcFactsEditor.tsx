/**
 * NpcFactsEditor — editable list of player-decided facts about a crawler bay's
 * embedded NPC (Slice F, #239).
 *
 * Composes the canonical `Conditions` chip row (chrome/Conditions) at its
 * `quiet` tone — the neutral, prose-cased rung — inside the sheet's bordered
 * well, exactly as its sibling ConditionsEditor composes the warn tone. This
 * used to hand-roll the chip geometry, the × remove button and the dashed
 * '+ Add' affordance; that fork is what the one-label-chip rule exists to kill.
 *
 * Facts are a LIST, not a set: they may legitimately repeat, so a commit never
 * de-dupes (unlike ConditionsEditor) and a removal is by index.
 *
 * Persistence: onChange receives the next facts array. Callers wire this to
 * store.update reading the freshest crawlerBays from the store to avoid
 * stale-closure stomps (see CrawlerSheet.CrawlerBayCard.patchEntry).
 *
 * readOnly: suppresses both the remove control on each fact and the "+ Add"
 * affordance — facts render as plain chips (published snapshots).
 */

import { Conditions } from '../chrome/Conditions'
import { INPUT_FOCUS } from '../chrome/interaction'
import { cn } from '../../utils/cn'
import { useChipDraft } from './useChipDraft'

type NpcFactsEditorProps = {
  facts: ReadonlyArray<string>
  onChange: (next: string[]) => Promise<void> | void
  /** Used to disambiguate aria-labels when multiple editors render at once. */
  npcLabel: string
  readOnly?: boolean
}

export function NpcFactsEditor({
  facts,
  onChange,
  npcLabel,
  readOnly = false,
}: NpcFactsEditorProps) {
  const draft = useChipDraft({
    disabled: readOnly,
    // No de-dupe: two crew facts can say the same thing about different things.
    onCommit: (value) => onChange([...facts, value]),
  })

  /** Remove by position — identical facts are distinct entries. */
  async function removeAt(index: number) {
    if (readOnly) return
    await onChange(facts.filter((_, i) => i !== index))
  }

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded border-chrome border-ink bg-paper p-2">
      {facts.length === 0 && !draft.adding && (
        <span className="font-body text-xs text-wk-muted">No facts yet</span>
      )}

      {/* Only rendered when it has chips or the '+ Add' affordance to show —
          an empty row would still count as a flex item and double the gap. */}
      {(facts.length > 0 || (!readOnly && !draft.adding)) && (
        <Conditions
          conditions={[...facts]}
          tone="quiet"
          onRemove={readOnly ? undefined : (_fact, index) => void removeAt(index)}
          removeLabel={(fact) => `Remove ${npcLabel} fact ${fact}`}
          onAdd={readOnly || draft.adding ? undefined : draft.startAdd}
          addLabel={`Add ${npcLabel} fact`}
        />
      )}

      {!readOnly && draft.adding && (
        <input
          {...draft.inputProps}
          aria-label={`New ${npcLabel} fact`}
          className={cn(
            'w-40 rounded-badge border border-ink bg-paper px-1.5 py-0.5 font-cond text-badge tracking-caps-tight text-ink',
            INPUT_FOCUS
          )}
        />
      )}
    </div>
  )
}
