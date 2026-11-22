/**
 * Every change of a live number on a
 * sheet or in Play shows one line with Undo ("EP 10 → 8 · Undo"), on the
 * document's one toaster (`ToasterMount`), as `destroyedUndoToast` does for a
 * destroyed item.
 *
 * Each change has its own Undo (r3 B2): a second change to the same number
 * while its line is up replaces the line, and Undo writes back the value from
 * just before that change, never one from further back. Undo hands the
 * keyboard back to the control that made the change (r3 J4).
 */

import { ArrowRight } from 'lucide-react'
import type { CSSProperties } from 'react'
import { toast, tokens } from '../components/index'
import { componentsCopy } from '../messages/components'

/** One number a line moves: its name, the value just before the change, and now. */
export type UndoChange = { key: string; label: string; from: number; to: number }

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
  /** Writes the value from just before the change. */
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
 * handed each number's value from before the change, by its key, to write back together.
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
  /** Writes back each number as it was before the change, by its key. */
  undo: (start: Record<string, number>) => void
}) {
  const moved = changes.filter((c) => c.from !== c.to)
  if (moved.length === 0) return
  const start = Object.fromEntries(changes.map((c) => [c.key, c.from]))
  // The control that made the change: Undo takes the toast, and the focus on it, away.
  const used = typeof document === 'undefined' ? null : document.activeElement
  toast(
    <span style={FIGURES}>
      {did ? `${did} · ` : ''}
      {moved.map((c, i) => (
        <span key={c.key}>
          {i > 0 ? ' · ' : ''}
          {c.label} {c.from}
          <ArrowRight
            size={tokens.iconSize.mini}
            aria-label={componentsCopy('changedTo')}
            style={GLYPH}
          />
          {c.to}
        </span>
      ))}
    </span>,
    {
      id,
      duration: 8000,
      action: {
        label: componentsCopy('undo'),
        onClick: () => {
          undo(start)
          if (used instanceof HTMLElement && used.isConnected) used.focus()
        },
      },
    }
  )
}
