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
import { stepBackOr } from './sheetHistory'

/** One number a line moves: its name, the value just before the change, and now. */
export type UndoChange = { key: string; label: string; from: number; to: number }

/** The lines now showing, by their key. */
const open = new Set<string>()

/**
 * Take down every open line about one unit (r3 B3): a line's key carries its
 * unit's id as a whole segment (`mech:<id>:currentEP`). The sheet's own call,
 * when the player leaves it.
 */
export function dismissChangeUndo(unitId: string) {
  for (const id of [...open]) {
    if (!id.split(':').includes(unitId)) continue
    open.delete(id)
    toast.dismiss(id)
  }
}

/** A value's change is a glyph at the line's Size (K11), never a text arrow. */
const GLYPH = {
  display: 'inline-block',
  margin: `0 ${tokens.space[4]}`,
  verticalAlign: '-2px',
} satisfies CSSProperties

const FIGURES = { fontVariantNumeric: 'tabular-nums' } satisfies CSSProperties

/**
 * The control last focused outside the toasts: what Undo hands the keyboard
 * back to (r3 J4). Pressing Undo takes its toast, and the focus on it, away;
 * without this the next Tab starts at the top of the page.
 */
let lastUsed: Element | null = null
let watching = false

function watchFocus(): void {
  if (typeof document === 'undefined') return
  const note = (el: Element | null) => {
    if (el !== null && el !== document.body && el.closest('[data-sonner-toaster]') === null)
      lastUsed = el
  }
  note(document.activeElement)
  if (watching) return
  watching = true
  document.addEventListener('focusin', (event) => note(event.target as Element | null))
}

export function changeUndoToast({
  id,
  label,
  from,
  to,
  undo,
  did,
  sheet,
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
  /** The sheet the number is on, and its stored field: Undo steps its history (r8 E1). */
  sheet?: { id: string; field: string }
}) {
  changesUndoToast({
    id,
    did,
    changes: [{ key: 'value', label, from, to }],
    undo: (start) => undo(start.value ?? from),
    ...(sheet && { sheet: { id: sheet.id, fields: { value: sheet.field } } }),
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
  sheet,
}: {
  id: string
  did?: string
  changes: UndoChange[]
  /** Writes back each number as it was before the change, by its key. */
  undo: (start: Record<string, number>) => void
  /**
   * The sheet the change is on, and each number's stored field by its key:
   * Undo then steps the change back through that sheet's history, as its ⋯
   * menu does, and writes the values back only where it cannot (r8 E1).
   */
  sheet?: { id: string; fields: Record<string, string> }
}) {
  const moved = changes.filter((c) => c.from !== c.to)
  if (moved.length === 0) return
  const start = Object.fromEntries(changes.map((c) => [c.key, c.from]))
  watchFocus()
  open.add(id)
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
      action: {
        label: componentsCopy('undo'),
        onClick: () => {
          open.delete(id)
          const marks = sheet
            ? moved.flatMap((c) => {
                const field = sheet.fields[c.key]
                return field === undefined ? [] : [{ field, to: c.to }]
              })
            : []
          if (sheet) stepBackOr(sheet.id, marks, () => undo(start))
          else undo(start)
          if (lastUsed instanceof HTMLElement && lastUsed.isConnected) lastUsed.focus()
        },
      },
      onDismiss: () => open.delete(id),
      onAutoClose: () => open.delete(id),
    }
  )
}
