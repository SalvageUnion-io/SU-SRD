/**
 * PlayVitalAmount — "take 3 damage" as one write (LG-13): the amount form a
 * vital's number opens, in the gauge's place in a unit box (`PlayVital`) and
 * under the open rows of a phone's pinned vitals (`PlayPinnedVitals`). The
 * label with the value it has now ("SP 3/9", so what is being taken from
 * stays in view), the amount, − N, + N and ×; Enter takes the amount, Escape
 * closes. `onChange` gets the next value, clamped to 0…max (`vitalAfter`),
 * and, when the amount was more than there was, a note that it was capped
 * (r2 C6). The line under the row says so before the press, and says what an
 * amount must be when the one typed is not one.
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

/** What the amount typed will come to, or why it is no amount: its own line under the row. */
const HINT = {
  color: tokens.color.ink,
  flexBasis: '100%',
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.chip,
  margin: 0,
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
  /** `note` says the amount was capped, when it was. */
  onChange: (next: number, note?: string) => void
  onClose: () => void
  /** The controls' Size: Compact in a unit box, Full (44px) on the phone's pinned strip. */
  size?: 'compact' | 'full'
}) {
  const [amount, setAmount] = useState('')
  const n = amountOf(amount)
  const change = (sign: 1 | -1) => {
    if (n === null) return
    const next = vitalAfter(value, sign * n, max)
    // More than there was: the change says it was capped, never silently.
    onChange(next, next === value + sign * n ? undefined : playCopy('cappedAt', { value: next }))
    onClose()
  }
  const room = max - value
  const hint =
    n === null
      ? amount.trim() === ''
        ? ''
        : playCopy('amountMustBe')
      : [
          ...(n > value ? [playCopy('takeCapped', { left: value, amount: n })] : []),
          ...(n > room ? [playCopy('addCapped', { room, amount: n, max })] : []),
        ].join(' ')
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
      <span className={capsLabel({ size: 'badge' })}>
        {label} {value}/{max}
      </span>
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
      <p role="status" style={HINT} hidden={hint === ''}>
        {hint}
      </p>
    </form>
  )
}
