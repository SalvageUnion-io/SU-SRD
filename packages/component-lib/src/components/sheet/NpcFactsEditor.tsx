/**
 * NpcFactsEditor — editable list of player-decided facts about a crawler bay's
 * embedded NPC (Slice F, #239). Generic add/remove string-list editor mirroring
 * ConditionsEditor's chip pattern, but labelled for NPC facts.
 *
 * Persistence: onChange receives the next facts array. Callers wire this to
 * store.update reading the freshest crawlerBays from the store to avoid
 * stale-closure stomps (see CrawlerSheet.CrawlerBayCard.patchEntry).
 *
 * readOnly: suppresses both the remove control on each fact and the "+ Add"
 * affordance — facts render as plain chips (published snapshots).
 */

import { useRef, useState } from 'react'

import { cn } from '../../utils/cn'

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
    await onChange([...facts, value])
    cancelAdd()
  }

  async function removeAt(index: number) {
    if (readOnly) return
    await onChange(facts.filter((_, i) => i !== index))
  }

  const chipBase =
    'inline-flex items-center gap-1 rounded-badge px-2 py-0.5 font-cond text-badge font-semibold tracking-[.03em]'

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded border-chrome border-ink bg-paper p-2">
      {facts.length === 0 && !adding && (
        <span className="font-body text-xs text-wk-muted">No facts yet</span>
      )}

      {facts.map((fact, index) =>
        readOnly ? (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: facts are free-form strings that may repeat; value+index is the most stable key available and chips hold no state
            key={`${fact}-${index}`}
            className={cn(chipBase, 'bg-wk-bg text-ink-50')}
          >
            {fact}
          </span>
        ) : (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: facts are free-form strings that may repeat; value+index is the most stable key available and chips hold no state
            key={`${fact}-${index}`}
            className={cn(chipBase, 'bg-wk-bg text-ink-50')}
          >
            {fact}
            <button
              type="button"
              aria-label={`Remove ${npcLabel} fact ${fact}`}
              onClick={() => {
                void removeAt(index)
              }}
              className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-pip leading-none hover:bg-ink/10"
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
            aria-label={`New ${npcLabel} fact`}
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
            className="w-40 rounded-badge border border-ink bg-paper px-1.5 py-0.5 font-cond text-badge tracking-[.03em] text-ink focus:outline-none focus:ring-1 focus:ring-rust/25"
          />
        ) : (
          <button
            type="button"
            aria-label={`Add ${npcLabel} fact`}
            onClick={startAdd}
            className={cn(
              chipBase,
              'border border-dashed border-ink/40 bg-transparent text-wk-muted hover:border-ink hover:text-ink'
            )}
          >
            + Add Fact
          </button>
        ))}
    </div>
  )
}
