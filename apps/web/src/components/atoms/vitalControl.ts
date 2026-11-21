/**
 * useVitalControl — how a live number steps, wherever it is drawn: the sheet's
 * header strip (`Strip`) and the phone's vitals block (`PhoneVitals`) share
 * it, so a vital words, clamps and writes one way (R12: one stepper).
 *
 * Writes are server-first: the replica keeps the old value until the server
 * answers. So every step counts from the latest value it ASKED for, not the
 * render's, until the store catches up: two fast taps on + write value + 2,
 * never value + 1 twice. A step that never lands (refused, offline) stops
 * counting after `ASK_HOLDS`. The − | + press repeats on a hold; the meter's
 * arrow keys, Home and End, and a tap on a segment (`pipClickValue`) step the
 * same way.
 */

import type { KeyboardEvent, MouseEvent } from 'react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { atomsCopy } from '../../messages/components-atoms'
import type { TrackSegmentState } from './pipRows'
import { pipClickValue, trackSegmentState } from './pipRows'
import type { ProvenanceLine } from './StatProvenance'

/** A live number's row: the shape `Strip` and `PhoneVitals` both take. */
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
  /** With it (and `onChange`) the value is a button: the caller asks for an amount. */
  onValuePress?: () => void
  /**
   * Edit's Free Edit of the max (ruleset §2.1): the max is a button that
   * opens a field, with where it comes from and a revert once overridden.
   */
  maxEdit?: VitalMaxEdit
}

/** The max's override, as `VitalGauge`'s `onMaxChange` family takes it. */
export type VitalMaxEdit = {
  onMaxChange: (next: number) => void
  /** Whether the max is overridden, and the derived value it reverts to. */
  breakdown?: { overridden?: boolean; derived?: number }
  onRevertOverride?: () => void
  /** Where the max comes from, line by line (`StatProvenance`). */
  provenance?: ProvenanceLine[]
}

/** A hold repeats after this long, then at this pace. */
const HOLD_DELAY = 420
const HOLD_EVERY = 110
/** How long a step it asked for counts before the store must have caught up. */
const ASK_HOLDS = 1500

export type VitalControl = {
  /** The value drawn: the store's, clamped where it steps. */
  shown: number
  /** Past its max (a read-out over capacity). */
  over: boolean
  /** The meter's segment count: its max, or the value when over it. */
  count: number
  /** Its spoken reading: "Hit Points 7 of 10". */
  summary: string
  /** Each segment's state on the track. */
  segment: (index: number) => TrackSegmentState
  /** Can step down / up from the latest asked value. */
  atFloor: boolean
  atCeiling: boolean
  /** Props for a − (−1) or + (+1) button: a press steps once, a hold repeats. */
  press: (delta: number) => {
    onPointerDown: () => void
    onPointerUp: () => void
    onPointerLeave: () => void
    onPointerCancel: () => void
    onClick: () => void
  }
  /** The meter-slider's arrow keys, Home and End. */
  onKeyDown: (event: KeyboardEvent) => void
  /** A tap on a segment (`[data-pip-index]`) sets the value. */
  onMeterClick: (event: MouseEvent<HTMLElement>) => void
}

export function useVitalControl(vital: PhoneVital): VitalControl {
  const { name, value, max, danger, onChange } = vital
  const ceiling = max ?? Number.POSITIVE_INFINITY
  const clamp = (next: number) => Math.min(Math.max(next, 0), ceiling)
  const shown = onChange ? clamp(value) : Math.max(0, value)

  // The step last asked for, until the store reaches it; and the freshest
  // value and writer, for a hold that began renders ago. Synced after render,
  // never during it.
  const asked = useRef<{ value: number; timer: ReturnType<typeof setTimeout> } | null>(null)
  const live = useRef({ shown, onChange, ceiling })
  useLayoutEffect(() => {
    if (asked.current?.value === shown) {
      clearTimeout(asked.current.timer)
      asked.current = null
    }
    live.current = { shown: asked.current?.value ?? shown, onChange, ceiling }
  })
  const hold = useRef<{ timer?: ReturnType<typeof setTimeout>; held: boolean }>({ held: false })
  // A row that leaves mid-hold or mid-ask stops its timers.
  useEffect(
    () => () => {
      clearTimeout(hold.current.timer)
      clearTimeout(asked.current?.timer)
    },
    []
  )

  const setTo = (target: number) => {
    const now = live.current
    const next = Math.min(Math.max(target, 0), now.ceiling)
    if (next === now.shown || !now.onChange) return
    clearTimeout(asked.current?.timer)
    asked.current = {
      value: next,
      timer: setTimeout(() => {
        asked.current = null
      }, ASK_HOLDS),
    }
    now.shown = next
    now.onChange(next)
  }
  const stepBy = (delta: number) => setTo(live.current.shown + delta)
  const stop = () => {
    clearTimeout(hold.current.timer)
    hold.current.timer = undefined
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
    const from = live.current.shown
    const to: Record<string, number> = {
      ArrowRight: from + 1,
      ArrowUp: from + 1,
      ArrowLeft: from - 1,
      ArrowDown: from - 1,
      Home: 0,
      End: max,
    }
    const next = to[event.key]
    if (next === undefined) return
    event.preventDefault()
    setTo(next)
  }
  const onMeterClick = (event: MouseEvent<HTMLElement>) => {
    if (!onChange || !(event.target instanceof Element)) return
    const raw = event.target.closest('[data-pip-index]')?.getAttribute('data-pip-index')
    if (raw != null) setTo(pipClickValue(Number(raw), live.current.shown))
  }

  return {
    shown,
    over: max !== undefined && shown > max,
    count: max === undefined ? 0 : Math.max(max, shown),
    summary:
      max === undefined
        ? atomsCopy('valueOf', { name, value: shown })
        : atomsCopy('valueOfMax', { name, value: shown, max }),
    segment: (index) => trackSegmentState(index, shown, max ?? 0, danger),
    atFloor: shown <= 0,
    atCeiling: shown >= ceiling,
    press,
    onKeyDown,
    onMeterClick,
  }
}

/** Past twelve a meter is two rows, so a segment never thins to a sliver. */
export function meterColumns(count: number): number {
  return count > 12 ? Math.ceil(count / 2) : count
}
