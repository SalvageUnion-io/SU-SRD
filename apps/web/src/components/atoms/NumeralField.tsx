/**
 * NumeralField — a count you can type (r6 E18): the numeral is a button that
 * opens a number field, so 8 Scrap is "8, Enter" rather than eight presses of
 * +. Enter or blur sets it, Escape keeps it; the −/+ beside it still step.
 * `Stat`'s `typeable` and a counter's numeral (`Strip`, `PhoneVitals`) draw it.
 */

import type { KeyboardEvent, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { atomsCopy } from '../../messages/components-atoms'
import { FOCUS_RING } from './interaction'

export function NumeralField({
  label,
  value,
  onSet,
  min = 0,
  max,
  children,
}: {
  /** The count's name, for the button's and the field's names: `T1 Scrap`, `Training Points`. */
  label: string
  value: number
  onSet: (next: number) => void
  min?: number
  max?: number | undefined
  /** What the button shows; the value by default. */
  children?: ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const input = useRef<HTMLInputElement>(null)
  // Enter commits and unmounts the field, whose blur must not commit again.
  const committed = useRef(false)
  useEffect(() => {
    if (!editing) return
    input.current?.focus()
    input.current?.select()
  }, [editing])

  const commit = () => {
    if (committed.current) return
    committed.current = true
    setEditing(false)
    const typed = Number.parseInt(draft, 10)
    if (!Number.isFinite(typed)) return
    const next = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, typed))
    if (next !== value) onSet(next)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      committed.current = true
      setEditing(false)
    }
  }

  return editing ? (
    <input
      ref={input}
      type="number"
      inputMode="numeric"
      enterKeyHint="done"
      min={min}
      max={max}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={commit}
      onClick={(event) => event.stopPropagation()}
      aria-label={atomsCopy('setCount', { label })}
      className="su-numeral-field__input"
    />
  ) : (
    <button
      type="button"
      className={cn('su-numeral-field__button', FOCUS_RING)}
      aria-label={atomsCopy('setCountNow', { label, value })}
      onClick={(event) => {
        // A picker card's own click would act on it too.
        event.stopPropagation()
        committed.current = false
        setDraft(String(value))
        setEditing(true)
      }}
    >
      {children ?? value}
    </button>
  )
}
