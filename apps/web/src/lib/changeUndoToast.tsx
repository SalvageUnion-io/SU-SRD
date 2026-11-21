/**
 * Every change of a live number on a
 * sheet or in Play shows one line with Undo ("EP 10 → 8 · Undo"), on the
 * document's one toaster (`ToasterMount`), as `destroyedUndoToast` does for a
 * destroyed item.
 *
 * Presses on the same number while its line is up are one change: the line
 * keeps the value the run started from, and Undo writes that value back. A run
 * that ends where it started takes its line down.
 */

import { ArrowRight } from 'lucide-react'
import type { CSSProperties } from 'react'
import { toast, tokens } from '../components/index'

/** One number a line moves: its name, the value its run started from, and now. */
export type UndoChange = { key: string; label: string; from: number; to: number }

/** Each open line's numbers, by its key: each keeps the value its run started from. */
const origins = new Map<string, Map<string, UndoChange>>()

/** A value's change is a glyph at the line's Size (K11), never a text arrow. */
const GLYPH = {
  display: 'inline-block',
  margin: `0 ${tokens.space[4]}`,
  verticalAlign: '-2px',
} satisfies CSSProperties

const FIGURES = { fontVariantNumeric: 'tabular-nums' } satisfies CSSProperties

export function changeUndoToast({
  id,
  label,
  from,
  to,
  undo,
  did,
}: {
  /** The number's own key (`mech:<id>:currentEP`): one line a number. */
  id: string
  /** The number's name as its gauge says it: "EP". */
  label: string
  from: number
  to: number
  /** Writes the value the run started from. */
  undo: (value: number) => void
  /** What made the change, said first: "Used Squeeze It In". */
  did?: string
}) {
  changesUndoToast({
    id,
    did,
    changes: [{ key: 'value', label, from, to }],
    undo: (start) => undo(start.value ?? from),
  })
}

/**
 * One line for a change that moves several numbers at once (an activation's
 * EP, Heat and Uses): "Used Hover · EP 10 → 8 · Heat 0 → 2 · Undo". Undo is
 * handed each number's starting value, by its key, to write back together.
 */
export function changesUndoToast({
  id,
  did,
  changes,
  undo,
}: {
  id: string
  did?: string
  changes: UndoChange[]
  /** Writes back each number the run started from, by its key. */
  undo: (start: Record<string, number>) => void
}) {
  const run = new Map(origins.get(id) ?? [])
  for (const change of changes) {
    const open = run.get(change.key)
    run.set(change.key, { ...change, from: open?.from ?? change.from })
  }
  const moved = [...run.values()].filter((c) => c.from !== c.to)
  if (moved.length === 0) {
    origins.delete(id)
    toast.dismiss(id)
    return
  }
  origins.set(id, run)
  const start = Object.fromEntries([...run.values()].map((c) => [c.key, c.from]))
  toast(
    <span style={FIGURES}>
      {did ? `${did} · ` : ''}
      {moved.map((c, i) => (
        <span key={c.key}>
          {i > 0 ? ' · ' : ''}
          {c.label} {c.from}
          <ArrowRight size={tokens.iconSize.mini} aria-label="to" style={GLYPH} />
          {c.to}
        </span>
      ))}
    </span>,
    {
      id,
      duration: 8000,
      action: {
        label: 'Undo',
        onClick: () => {
          origins.delete(id)
          undo(start)
        },
      },
      onDismiss: () => origins.delete(id),
      onAutoClose: () => origins.delete(id),
    }
  )
}
