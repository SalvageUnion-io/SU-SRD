/**
 * useChipDraft — the inline "type a new chip" state machine shared by every
 * editable chip row on a live sheet (ConditionsEditor, NpcFactsEditor).
 *
 * The rows differ in what a commit MEANS (conditions are a set and de-dupe
 * case-insensitively; facts are a list and may legitimately repeat), so this
 * owns only the part that was identical in both: the adding/draft/inputRef
 * triple, focus-on-open, and the Enter-commits / Escape-cancels / blur-commits
 * handler. The commit policy stays at the call site, in `onCommit`.
 *
 * `inputProps` is spread onto the row's `<input>`; the call site still supplies
 * its own `aria-label` and geometry classes.
 */

import type { ChangeEvent, KeyboardEvent, RefObject } from 'react'
import { useRef, useState } from 'react'

type UseChipDraftOptions = {
  /**
   * Commit a trimmed, non-empty draft. An empty draft never reaches this — it
   * cancels instead. May be async; the draft closes after it resolves.
   */
  onCommit: (value: string) => Promise<void> | void
  /** Read-only rows never open the draft input. */
  disabled?: boolean
}

export type ChipDraft = {
  /** True while the inline input is open. */
  adding: boolean
  /** Open the input and focus it (no-op when disabled). */
  startAdd: () => void
  /** Close the input, discarding the draft. */
  cancelAdd: () => void
  /** Spread onto the row's `<input>`. */
  inputProps: {
    ref: RefObject<HTMLInputElement | null>
    type: 'text'
    value: string
    onChange: (event: ChangeEvent<HTMLInputElement>) => void
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
    onBlur: () => void
  }
}

export function useChipDraft({ onCommit, disabled = false }: UseChipDraftOptions): ChipDraft {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function startAdd() {
    if (disabled) return
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
    await onCommit(value)
    cancelAdd()
  }

  return {
    adding,
    startAdd,
    cancelAdd,
    inputProps: {
      ref: inputRef,
      type: 'text',
      value: draft,
      onChange: (event) => setDraft(event.target.value),
      onKeyDown: (event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          void commitAdd()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          cancelAdd()
        }
      },
      onBlur: () => {
        void commitAdd()
      },
    },
  }
}
