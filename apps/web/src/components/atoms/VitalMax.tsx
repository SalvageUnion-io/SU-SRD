/**
 * VitalMax — a vital's max in Edit (ruleset §2.1, Free Edit): the number is a
 * button that opens a field (Enter or blur sets it, Escape keeps it); an
 * overridden max reads in the tone's deep ink with its asterisk, where it comes
 * from a press away (`StatProvenance`), and ↺ reverts it to the derived value.
 * The words are `VitalGauge`'s, so a max reads alike wherever it is edited.
 */

import type { KeyboardEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { atomsCopy } from '../../messages/components-atoms'
import { FOCUS_RING } from './interaction'
import { StatProvenance } from './StatProvenance'
import type { VitalMaxEdit } from './vitalControl'

export function VitalMax({ label, max, edit }: { label: string; max: number; edit: VitalMaxEdit }) {
  const overridden = edit.breakdown?.overridden === true
  const derived = edit.breakdown?.derived
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const input = useRef<HTMLInputElement>(null)
  // Enter commits and unmounts the field, whose blur must not commit again.
  const committed = useRef(false)
  useEffect(() => {
    if (editing) input.current?.focus()
  }, [editing])

  const commit = () => {
    if (committed.current) return
    committed.current = true
    setEditing(false)
    const next = Number.parseInt(draft, 10)
    if (Number.isFinite(next) && next >= 0) edit.onMaxChange(next)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      committed.current = true
      setEditing(false)
    }
  }

  return (
    <span className="su-vital-max" data-overridden={overridden ? '' : undefined}>
      {editing ? (
        <input
          ref={input}
          type="number"
          inputMode="numeric"
          enterKeyHint="done"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          aria-label={atomsCopy('setMax', { label })}
          className="su-vital-max__input"
        />
      ) : (
        <button
          type="button"
          className={cn('su-vital-max__button', FOCUS_RING)}
          aria-label={atomsCopy('overrideMaxCurrently', { label, max })}
          onClick={() => {
            committed.current = false
            setDraft(String(max))
            setEditing(true)
          }}
        >
          {max}
        </button>
      )}
      {edit.provenance && (
        <StatProvenance
          statLabel={atomsCopy('max', { label })}
          lines={edit.provenance}
          total={max}
          overridden={overridden}
          className="su-vital-max__why"
        >
          {overridden ? '*' : 'ⓘ'}
        </StatProvenance>
      )}
      {overridden && edit.onRevertOverride && !editing && derived !== undefined && (
        <button
          type="button"
          className={cn('su-vital-max__revert', FOCUS_RING)}
          onClick={edit.onRevertOverride}
          aria-label={atomsCopy('revertMaxToDerived', { label, overriddenFrom: derived })}
          title={atomsCopy('revertToDerived', { overriddenFrom: derived })}
        >
          ↺
        </button>
      )}
    </span>
  )
}
