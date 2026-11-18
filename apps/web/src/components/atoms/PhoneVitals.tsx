/**
 * MOCK (wave 2, phone vitals): PhoneVitals, a phone's vitals block for every
 * Live Sheet and for Play: one quiet card, one 52px row a number. A row is
 * the short label (SP), a slim segmented meter in the kind's colour
 * (`--tone`, the band colour of the colour map; Heat's redline in `--color-status-bad`), the
 * value over its max in plain tabular numerals, and a joined − | + pair, each
 * half a 44px target. A press steps by one; a hold repeats. The meter is the
 * one `role="slider"` tab stop a row has (arrow keys, Home, End), and a tap on
 * a segment sets the value.
 *
 * A row with no `max` is a counter (Training Points, Upkeep): no meter, its
 * note in the meter's place. `foot` is the block's last row: conditions, a
 * crawler's Pay / Fund / Trade.
 *
 * It strays from the site's dress on purpose (the owner's phone-vitals
 * ruling): no ink stamp, no framed numeral, no ink-block steppers. Tokens and
 * the colour map only. Desktop keeps `VitalGauge`.
 *
 * Geometry and states are `.su-phone-vitals*` (`styles/partials/phone-vitals.css`):
 * every property here has a pressed, disabled or per-row variant.
 */

import { Minus, Plus } from 'lucide-react'
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { cn } from '../../lib/cn'
import { FOCUS_RING } from './interaction'
import { pipClickValue, trackSegmentState } from './pipRows'

export type PhoneVital = {
  /** The row's key, and its `data-vital`. */
  key: string
  /** The short label: `SP`, `Heat`, `TP`. */
  label: string
  /** The words in full, for assistive tech and the title: `Structure Points`. */
  name: string
  value: number
  /** The meter's length. Omitted, the row is a counter with no meter. */
  max?: number
  /** A counter's quiet note, in the meter's place: `T1+ Scrap`. */
  note?: string
  /** First 0-based segment that reads danger (Heat's redline). */
  danger?: number
  /** With it the row steps: − | +, the meter's taps and its arrow keys. */
  onChange?: (next: number) => void
}

type PhoneVitalsProps = {
  /** Names the block: "Mazona vitals". */
  label: string
  vitals: readonly PhoneVital[]
  /** The block's last row: conditions, action chips. */
  foot?: ReactNode
  className?: string
  /** Pins `--tone` / `--tone-deep` where the surface sets none (Play). */
  style?: CSSProperties
}

/** A hold repeats after this long, then at this pace. */
const HOLD_DELAY = 420
const HOLD_EVERY = 110

export function PhoneVitals({ label, vitals, foot, className, style }: PhoneVitalsProps) {
  const steps = vitals.some((vital) => vital.onChange)
  return (
    // biome-ignore lint/a11y/useSemanticElements: a labelled group, not a landmark
    <div
      role="group"
      aria-label={label}
      className={cn('su-phone-vitals', className)}
      data-steps={steps ? '' : undefined}
      style={style}
    >
      {vitals.map((vital) => (
        <Row key={vital.key} vital={vital} />
      ))}
      {foot && <div className="su-phone-vitals__foot">{foot}</div>}
    </div>
  )
}

function Row({ vital }: { vital: PhoneVital }) {
  const { label, name, value, max, note, danger, onChange } = vital
  const ceiling = max ?? Number.POSITIVE_INFINITY
  const clamp = (next: number) => Math.min(Math.max(next, 0), ceiling)
  const shown = onChange ? clamp(value) : Math.max(0, value)
  const over = max !== undefined && shown > max
  // A hold reads the freshest value and writer, not the render it began in.
  // It also counts from the step it just asked for until the store catches
  // up, so fast presses never step twice from one stale value.
  const asked = useRef<{ value: number; timer?: ReturnType<typeof setTimeout> } | null>(null)
  if (asked.current?.value === shown) asked.current = null
  const live = useRef({ shown, onChange, ceiling })
  live.current = { shown: asked.current?.value ?? shown, onChange, ceiling }
  const hold = useRef<{ timer?: ReturnType<typeof setTimeout>; held: boolean }>({ held: false })
  const stop = () => {
    clearTimeout(hold.current.timer)
    hold.current.timer = undefined
  }
  // A row that leaves mid-hold stops repeating.
  useEffect(() => () => clearTimeout(hold.current.timer), [])
  const stepBy = (delta: number) => {
    const now = live.current
    const next = Math.min(Math.max(now.shown + delta, 0), now.ceiling)
    if (next === now.shown) return
    clearTimeout(asked.current?.timer)
    asked.current = {
      value: next,
      // A write that never lands (refused, offline) stops counting.
      timer: setTimeout(() => {
        asked.current = null
      }, 1500),
    }
    now.shown = next
    now.onChange?.(next)
  }
  const press = (delta: number) => ({
    onPointerDown: () => {
      hold.current.held = false
      const repeat = () => {
        hold.current.held = true
        stepBy(delta)
        hold.current.timer = setTimeout(repeat, HOLD_EVERY)
      }
      hold.current.timer = setTimeout(repeat, HOLD_DELAY)
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    // The press itself (and a key's): one step, unless a hold already stepped.
    onClick: () => {
      if (!hold.current.held) stepBy(delta)
      hold.current.held = false
    },
  })

  const onKeyDown = (event: KeyboardEvent) => {
    if (!onChange || max === undefined) return
    const to: Record<string, number> = {
      ArrowRight: shown + 1,
      ArrowUp: shown + 1,
      ArrowLeft: shown - 1,
      ArrowDown: shown - 1,
      Home: 0,
      End: max,
    }
    const next = to[event.key]
    if (next === undefined) return
    event.preventDefault()
    onChange(clamp(next))
  }
  const onMeterClick = (event: MouseEvent<HTMLElement>) => {
    if (!onChange || !(event.target instanceof Element)) return
    const raw = event.target.closest('[data-pip-index]')?.getAttribute('data-pip-index')
    if (raw != null) onChange(clamp(pipClickValue(Number(raw), shown)))
  }

  const count = max === undefined ? 0 : Math.max(max, shown)
  // Past twelve the meter is two rows, so a segment never thins to a sliver.
  const columns = count > 12 ? Math.ceil(count / 2) : count
  const summary = max === undefined ? `${name} ${shown}` : `${name} ${shown} of ${max}`
  const segments = Array.from({ length: count }, (_, index) => (
    <span
      // biome-ignore lint/suspicious/noArrayIndexKey: a meter's segments are its positions
      key={index}
      className="su-phone-vitals__seg"
      data-pip-index={index}
      data-state={trackSegmentState(index, shown, max ?? 0, danger)}
    />
  ))
  const meterStyle = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }

  return (
    <div className="su-phone-vitals__row" data-vital={vital.key}>
      <span className="su-phone-vitals__label" title={name}>
        {label}
      </span>
      {max === undefined ? (
        <span className="su-phone-vitals__note">{note}</span>
      ) : onChange ? (
        <div
          role="slider"
          tabIndex={0}
          aria-label={name}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={shown}
          aria-valuetext={summary}
          className={cn('su-phone-vitals__meter', FOCUS_RING)}
          data-rows={count > 12 ? 2 : 1}
          data-live=""
          style={meterStyle}
          onKeyDown={onKeyDown}
          onClick={onMeterClick}
        >
          {segments}
        </div>
      ) : (
        <div
          role="img"
          aria-label={summary}
          className="su-phone-vitals__meter"
          data-rows={count > 12 ? 2 : 1}
          style={meterStyle}
        >
          {segments}
        </div>
      )}
      <span className="su-phone-vitals__value" data-over={over ? '' : undefined}>
        <b>{shown}</b>
        {max !== undefined && <i>/{max}</i>}
      </span>
      {onChange && (
        <span className="su-phone-vitals__stepper">
          <button
            type="button"
            aria-label={`Decrease ${name}`}
            disabled={shown <= 0}
            className={FOCUS_RING}
            {...press(-1)}
          >
            <Minus aria-hidden="true" size={18} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            aria-label={`Increase ${name}`}
            disabled={shown >= ceiling}
            className={FOCUS_RING}
            {...press(1)}
          >
            <Plus aria-hidden="true" size={18} strokeWidth={2.5} />
          </button>
        </span>
      )}
    </div>
  )
}
