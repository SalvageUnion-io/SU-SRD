/**
 * NpcFactsEditor — editable list of player-decided facts about a crawler bay's
 * embedded NPC.
 *
 * Composes the canonical `Conditions` chip row (chrome/Conditions) at its
 * `quiet` tone — the neutral, prose-cased rung — inside the sheet's bordered
 * well, exactly as its sibling ConditionsEditor composes the warn tone, never
 * hand-rolled chip geometry — the fork the one-label-chip rule exists to kill.
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

import type { CSSProperties } from 'react'
import { Conditions, EmptyState, INPUT_FOCUS, tokens } from '../../../ui/index'
import { useChipDraft } from './useChipDraft'

/** The sheet's bordered well around the chip row. */
const WELL = {
  alignItems: 'center',
  backgroundColor: tokens.color.paper,
  border: `${tokens.borderWidth.chrome} solid ${tokens.color.ink}`,
  borderRadius: '0.25rem',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[6],
  minHeight: '2.5rem',
  padding: tokens.space[8],
} satisfies CSSProperties

/** The new-fact input, set in the quiet chip's prose-cased type. */
const DRAFT_INPUT = {
  backgroundColor: tokens.color.paper,
  border: `${tokens.borderWidth.hairline} solid ${tokens.color.ink}`,
  borderRadius: tokens.radius.badge,
  color: tokens.color.ink,
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  letterSpacing: tokens.tracking.capsTight,
  paddingBlock: tokens.space[2],
  paddingInline: tokens.space[6],
  width: '10rem',
} satisfies CSSProperties

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
    <div style={WELL}>
      {facts.length === 0 && !draft.adding && <EmptyState variant="quiet" body="No facts yet" />}

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
          className={INPUT_FOCUS}
          style={DRAFT_INPUT}
        />
      )}
    </div>
  )
}
