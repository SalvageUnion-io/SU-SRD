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
import { componentsCopy } from '../messages/components'

/** The value each number's open line started from, by its key. */
const origins = new Map<string, number>()

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
  const origin = origins.get(id) ?? from
  if (origin === to) {
    origins.delete(id)
    toast.dismiss(id)
    return
  }
  origins.set(id, origin)
  toast(
    <span style={FIGURES}>
      {did ? `${did} · ` : ''}
      {label} {origin}
      <ArrowRight
        size={tokens.iconSize.mini}
        aria-label={componentsCopy('changedTo')}
        style={GLYPH}
      />
      {to}
    </span>,
    {
      id,
      duration: 8000,
      action: {
        label: componentsCopy('undo'),
        onClick: () => {
          origins.delete(id)
          undo(origin)
        },
      },
      onDismiss: () => origins.delete(id),
      onAutoClose: () => origins.delete(id),
    }
  )
}
