/**
 * PlayVitalAmount — "take 3 damage" as one write (LG-13): the amount form a
 * vital's number opens, in the gauge's place in a unit box (`PlayVital`) and
 * under the open rows of a phone's pinned vitals (`PlayPinnedVitals`). The
 * label, the amount, − N, + N and ×; Enter takes the amount, Escape closes.
 * `onChange` gets the next value, clamped to 0…max (`vitalAfter`).
 */

import type { CSSProperties } from 'react'
import { useState } from 'react'
import { Button, CloseButton, capsLabel, Input, tokens } from '../components/index'
import { playCopy } from '../messages/play'
import { amountOf, vitalAfter } from './unitStats.model'

const AMOUNT = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[6],
  minWidth: 0,
} satisfies CSSProperties

const AMOUNT_INPUT = { flex: '1 1 3rem', minWidth: '3rem', width: '3rem' } satisfies CSSProperties

export function PlayVitalAmount({
  label,
  value,
  max,
  onChange,
  onClose,
  size = 'compact',
}: {
  /** The stamp: HP, AP, SP, EP, Heat. */
  label: string
  value: number
  max: number
  onChange: (next: number) => void
  onClose: () => void
  /** The controls' Size: Compact in a unit box, Full (44px) on the phone's pinned strip. */
  size?: 'compact' | 'full'
}) {
  const [amount, setAmount] = useState('')
  const n = amountOf(amount)
  const change = (sign: 1 | -1) => {
    if (n === null) return
    onChange(vitalAfter(value, sign * n, max))
    onClose()
  }
  return (
    <form
      style={AMOUNT}
      aria-label={playCopy('changeByAmount', { label })}
      onSubmit={(event) => {
        event.preventDefault()
        change(-1)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
    >
      <span className={capsLabel({ size: 'badge' })}>{label}</span>
      <Input
        autoFocus
        numeric
        size={size}
        style={AMOUNT_INPUT}
        value={amount}
        aria-label={playCopy('amountOf', { label })}
        onChange={(event) => setAmount(event.target.value)}
      />
      <Button
        type="button"
        size={size}
        disabled={n === null}
        aria-label={playCopy('takeAmount', { label, amount: n ?? '' })}
        onClick={() => change(-1)}
      >
        − {n ?? ''}
      </Button>
      <Button
        type="button"
        size={size}
        disabled={n === null}
        aria-label={playCopy('addAmount', { label, amount: n ?? '' })}
        onClick={() => change(1)}
      >
        + {n ?? ''}
      </Button>
      <CloseButton label={playCopy('cancel')} onClick={onClose} />
    </form>
  )
}
