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
 * By keyboard a live vital is one Tab stop (`useVitalKeys`, r3 J4): ← / →
 * move between its number, slider, − and +, and the amount form hands the
 * focus back to the number it was opened from.
 *
 * Presentational: `onChange` is the box's write, called with the next value
 * already clamped to 0…max.
 */

import { ArrowRight } from 'lucide-react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { VitalGauge } from '../components/app'
import type { CSSVarStyle } from '../components/index'
import { tokens } from '../components/index'
import { playCopy } from '../messages/play'
import { PlayVitalAmount } from './PlayVitalAmount'
import { useVitalKeys } from './useVitalKeys'

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
  /**
   * Live: − / + and the slider write this. Absent, the vital is a read-out.
   * `note` is the amount entry's, when what was typed was capped.
   */
  onChange?: (next: number, note?: string) => void
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
  // A digit typed on the number opens the amount with that digit in it (r7 C8, MD7-21).
  const [seed, setSeed] = useState('')
  const keys = useVitalKeys()
  // The amount form closed: the focus goes back to the number that opened it (r3 J4).
  const back = useRef(false)
  useEffect(() => {
    if (asking || !back.current) return
    back.current = false
    keys.ref.current?.querySelector<HTMLElement>('.su-vital-gauge__value-button')?.focus()
  }, [asking, keys.ref])
  const digitOrKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const digit = /^[0-9]$/.test(event.key) && !event.altKey && !event.ctrlKey && !event.metaKey
    if (!digit || !target.classList.contains('su-vital-gauge__value-button')) {
      keys.onKeyDownCapture(event)
      return
    }
    event.preventDefault()
    setSeed(event.key)
    setAsking(true)
  }
  if (live && asking) {
    return (
      <PlayVitalAmount
        label={label}
        value={value}
        max={max}
        onChange={onChange}
        initial={seed}
        onClose={() => {
          back.current = true
          setSeed('')
          setAsking(false)
        }}
      />
    )
  }
  return (
    <div style={ROW} {...(live ? { ...keys, onKeyDownCapture: digitOrKeys } : {})}>
      <div style={GAUGE}>
        <VitalGauge
          size="compact"
          label={label}
          value={value}
          max={max}
          danger={danger}
          readOnly={!live}
          onChange={onChange ? (next) => onChange(next) : undefined}
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
