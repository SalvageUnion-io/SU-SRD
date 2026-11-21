/**
 * PlayVital — one vital in a Play unit box (play.md §4): the instrument
 * `VitalGauge` (its Compact rung: label, value/max, the pips) and, while the
 * unit is live, its − / + (`steppers`: the `StepButton` pair an editable
 * `Stat` draws, ruleset §6.3). A live gauge is also the gauge's own slider (a
 * click on a pip, the arrow keys), and its number is a button: pressed, it
 * asks for an amount and takes or adds it in one write. A reference unit's
 * is a read-out.
 *
 * In Downtime the mech's vitals say what the current step will restore:
 * `restoresTo` reads after the gauge as "→ 20", the gauge still showing what
 * the mech has now, since the step has not been applied.
 *
 * Presentational: `onChange` is the box's write, called with the next value
 * already clamped to 0…max.
 */

import { ArrowRight } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { VitalGauge } from '../components/app'
import type { CSSVarStyle } from '../components/index'
import { Button, CloseButton, capsLabel, Input, tokens } from '../components/index'
import { playCopy } from '../messages/play'
import { amountOf, vitalAfter } from './unitStats.model'

type VitalTone = 'pilot' | 'mech' | 'crawler' | 'adversary'

/** The gauge's `--tone` pair per unit, in its ontology hue. */
const TONES: Record<VitalTone, CSSVarStyle> = {
  pilot: { '--tone': 'var(--color-pilot)', '--tone-deep': 'var(--color-sheet-pilot-deep)' },
  mech: { '--tone': 'var(--color-mech)', '--tone-deep': 'var(--color-sheet-mech-deep)' },
  crawler: { '--tone': 'var(--color-crawler)', '--tone-deep': 'var(--color-sheet-crawler-deep)' },
  // The Opposition, on the Mediator's screen: the adversary tone its Compacts wear.
  adversary: { '--tone': 'var(--color-adversary)', '--tone-deep': 'var(--color-adversary)' },
}

const ROW = {
  alignItems: 'center',
  display: 'flex',
  gap: tokens.space[6],
  minWidth: 0,
} satisfies CSSProperties

/** The amount form, in the gauge's place: the label, the amount, − N, + N, ×. */
const AMOUNT = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[6],
  minWidth: 0,
} satisfies CSSProperties

const AMOUNT_INPUT = { flex: '1 1 3rem', minWidth: '3rem', width: '3rem' } satisfies CSSProperties

const GAUGE = { flex: '1 1 0%', minWidth: 0 } satisfies CSSProperties

/** The restore note's arrow, centred on its figures. */
const GLYPH = { verticalAlign: 'middle' } satisfies CSSProperties

const RESTORE = {
  flexShrink: 0,
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.readout,
  fontVariantNumeric: 'tabular-nums',
  fontWeight: tokens.weight.bold,
  whiteSpace: 'nowrap',
} satisfies CSSProperties

export type PlayVitalProps = {
  /** The stamp: HP, AP, SP, EP, Heat. */
  label: string
  value: number
  max: number
  tone: VitalTone
  /** First 0-based segment that reads as danger when lit (Heat's redline). */
  danger?: number
  /** Live: − / + and the slider write this. Absent, the vital is a read-out. */
  onChange?: (next: number) => void
  /** What the current Downtime step sets this vital to, when it changes it. */
  restoresTo?: number
}

export function PlayVital({
  label,
  value,
  max,
  tone,
  danger,
  onChange,
  restoresTo,
}: PlayVitalProps) {
  const live = onChange !== undefined
  // "Take 3 damage" is one write: press the number, type the amount, − or +.
  const [asking, setAsking] = useState(false)
  const [amount, setAmount] = useState('')
  const n = amountOf(amount)
  const change = (sign: 1 | -1) => {
    if (n === null || onChange === undefined) return
    onChange(vitalAfter(value, sign * n, max))
    setAmount('')
    setAsking(false)
  }
  if (live && asking) {
    return (
      <form
        style={AMOUNT}
        aria-label={playCopy('changeByAmount', { label })}
        onSubmit={(event) => {
          event.preventDefault()
          change(-1)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setAsking(false)
        }}
      >
        <span className={capsLabel({ size: 'badge' })}>{label}</span>
        <Input
          autoFocus
          numeric
          size="compact"
          style={AMOUNT_INPUT}
          value={amount}
          aria-label={playCopy('amountOf', { label })}
          onChange={(event) => setAmount(event.target.value)}
        />
        <Button
          type="button"
          size="compact"
          disabled={n === null}
          aria-label={playCopy('takeAmount', { label, amount: n ?? '' })}
          onClick={() => change(-1)}
        >
          − {n ?? ''}
        </Button>
        <Button
          type="button"
          size="compact"
          disabled={n === null}
          aria-label={playCopy('addAmount', { label, amount: n ?? '' })}
          onClick={() => change(1)}
        >
          + {n ?? ''}
        </Button>
        <CloseButton label={playCopy('cancel')} onClick={() => setAsking(false)} />
      </form>
    )
  }
  return (
    <div style={ROW}>
      <div style={GAUGE}>
        <VitalGauge
          size="compact"
          label={label}
          value={value}
          max={max}
          danger={danger}
          readOnly={!live}
          onChange={onChange}
          onValuePress={live ? () => setAsking(true) : undefined}
          steppers={live}
          style={TONES[tone]}
        />
      </div>
      {restoresTo !== undefined && restoresTo !== value ? (
        <span
          style={RESTORE}
          role="note"
          aria-label={playCopy('restoresTo', { label, restoresTo })}
        >
          {/* A value's change, a glyph at the line's Size (K11), never a text arrow. */}
          <ArrowRight size={tokens.iconSize.compact} aria-hidden="true" style={GLYPH} />{' '}
          {restoresTo}
        </span>
      ) : null}
    </div>
  )
}
