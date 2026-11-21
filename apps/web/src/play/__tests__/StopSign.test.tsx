/**
 * The Stop Sign's control (r2 I3): on a phone it is labelled and fires on a
 * hold, never on a brushed tap; from a keyboard, or on a desk, a press fires it.
 */

import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { StopSignButton } from '../StopSign'
import type { StopSign } from '../useStopSign'

function sign(over: Partial<StopSign> = {}) {
  let shown = 0
  const value = {
    shown: false,
    canWrite: true,
    pending: false,
    show: () => {
      shown += 1
    },
    ...over,
  } as StopSign
  return { value, shown: () => shown }
}

/** A hold the test runs itself: `elapse` is the timer firing. */
function hold() {
  let due: (() => void) | null = null
  return {
    timer: {
      set: (run: () => void) => {
        due = run
        return 1
      },
      clear: () => {
        due = null
      },
    },
    elapse: () => due?.(),
    waiting: () => due !== null,
  }
}

describe('the Stop Sign button', () => {
  test('on a desk it is the words, and a press shows the sign', () => {
    const s = sign()
    render(<StopSignButton sign={s.value} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show the Stop Sign' }))
    expect(s.shown()).toBe(1)
  })

  test('on a phone it wears a label, and only a hold shows the sign', () => {
    const s = sign()
    const h = hold()
    const told: string[] = []
    render(<StopSignButton sign={s.value} compact timer={h.timer} tell={(m) => told.push(m)} />)
    const button = screen.getByRole('button', { name: 'Show the Stop Sign' })
    expect(button.textContent).toBe('Stop')
    // A tap: down, up before the hold is over, then the browser's click.
    fireEvent.pointerDown(button)
    fireEvent.pointerUp(button)
    fireEvent.click(button, { detail: 1 })
    expect(s.shown()).toBe(0)
    expect(h.waiting()).toBe(false)
    expect(told).toEqual(['Hold to show the Stop Sign'])
    // A hold: the timer runs out with the finger still down.
    fireEvent.pointerDown(button)
    h.elapse()
    expect(s.shown()).toBe(1)
    fireEvent.pointerUp(button)
    fireEvent.click(button, { detail: 1 })
    expect(s.shown()).toBe(1)
    expect(told).toHaveLength(1)
  })

  test('a finger that slides off lets go of the hold', () => {
    const s = sign()
    const h = hold()
    render(<StopSignButton sign={s.value} compact timer={h.timer} tell={() => {}} />)
    const button = screen.getByRole('button', { name: 'Show the Stop Sign' })
    fireEvent.pointerDown(button)
    fireEvent.pointerLeave(button)
    expect(h.waiting()).toBe(false)
    expect(s.shown()).toBe(0)
  })

  test('on a phone a keyboard’s or a screen reader’s press shows it at once', () => {
    const s = sign()
    render(<StopSignButton sign={s.value} compact timer={hold().timer} tell={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show the Stop Sign' }), { detail: 0 })
    expect(s.shown()).toBe(1)
  })
})
