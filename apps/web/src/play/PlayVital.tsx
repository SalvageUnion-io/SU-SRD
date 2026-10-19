/**
 * PlayVital — one vital in a Play unit box (play.md §4): the instrument
 * `VitalGauge` (its Compact rung: label, value/max, the pips) and, while the
 * unit is live, a − / + pair beside it. A live gauge is also the gauge's own
 * slider (a click on a pip, the arrow keys); a reference unit's is a read-out.
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
import type { CSSVarStyle } from '../components/index'
import { Button, tokens, VitalGauge } from '../components/index'
import { nudge } from './units.model'

type VitalTone = 'pilot' | 'mech' | 'crawler' | 'adversary'

/** The gauge's `--tone` pair per unit, in its ontology hue. */
const TONES: Record<VitalTone, CSSVarStyle> = {
  pilot: { '--tone': 'var(--color-pilot)', '--tone-deep': 'var(--color-sheet-pilot-deep)' },
  mech: { '--tone': 'var(--color-mech)', '--tone-deep': 'var(--color-sheet-mech-deep)' },
  crawler: { '--tone': 'var(--color-crawler)', '--tone-deep': 'var(--color-sheet-crawler-deep)' },
  // The Opposition, on the Mediator's screen: the adversary tone its Rows wear.
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
          style={TONES[tone]}
        />
      </div>
      {restoresTo !== undefined && restoresTo !== value ? (
        <span style={RESTORE} role="note" aria-label={`${label} restores to ${restoresTo}`}>
          {/* A value's change, a glyph at the line's Size (R23), never a text arrow. */}
          <ArrowRight size={tokens.iconSize.compact} aria-hidden="true" style={GLYPH} />{' '}
          {restoresTo}
        </span>
      ) : null}
      {live ? (
        <>
          <Button
            variant="ghost"
            size="compact"
            aria-label={`${label} −1`}
            disabled={value <= 0}
            onClick={() => onChange(nudge(value, -1, max))}
          >
            −
          </Button>
          <Button
            variant="ghost"
            size="compact"
            aria-label={`${label} +1`}
            disabled={value >= max}
            onClick={() => onChange(nudge(value, 1, max))}
          >
            +
          </Button>
        </>
      ) : null}
    </div>
  )
}
