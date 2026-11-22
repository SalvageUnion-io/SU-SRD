/**
 * The Stop Sign's control (r2 I3): on a phone it is labelled and fires on a
 * hold, never on a brushed tap; from a keyboard, or on a desk, a press fires it.
 */

import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
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
    render(<StopSignButton sign={s.value} compact timer={h.timer} />)
    const button = screen.getByRole('button', { name: 'Show the Stop Sign' })
    expect(button.textContent).toBe('Stop · hold')
    // The hint is at the button itself (r4 B6), and says nothing until a tap comes up short.
    const hint = screen.getByRole('status')
    expect(hint.parentElement === button.parentElement).toBe(true)
    expect(hint.textContent).toBe('')
    // A tap: down, up before the hold is over, then the browser's click.
    fireEvent.pointerDown(button)
    fireEvent.pointerUp(button)
    fireEvent.click(button, { detail: 1 })
    expect(s.shown()).toBe(0)
    expect(h.waiting()).toBe(false)
    expect(hint.textContent).toBe('Hold to show the Stop Sign')
    expect(button.parentElement?.hasAttribute('data-holding')).toBe(false)
    // A hold: the button fills while the finger is down, and the hint goes;
    // the timer runs out with the finger still down.
    fireEvent.pointerDown(button)
    expect(button.parentElement?.hasAttribute('data-holding')).toBe(true)
    expect(hint.textContent).toBe('')
    act(() => h.elapse())
    expect(s.shown()).toBe(1)
    fireEvent.pointerUp(button)
    fireEvent.click(button, { detail: 1 })
    expect(s.shown()).toBe(1)
    expect(button.parentElement?.hasAttribute('data-holding')).toBe(false)
    expect(hint.textContent).toBe('')
  })

  test('a finger that slides off lets go of the hold', () => {
    const s = sign()
    const h = hold()
    render(<StopSignButton sign={s.value} compact timer={h.timer} />)
    const button = screen.getByRole('button', { name: 'Show the Stop Sign' })
    fireEvent.pointerDown(button)
    fireEvent.pointerLeave(button)
    expect(button.parentElement?.hasAttribute('data-holding')).toBe(false)
    expect(h.waiting()).toBe(false)
    expect(s.shown()).toBe(0)
  })

  test('on a phone a keyboard’s or a screen reader’s press shows it at once', () => {
    const s = sign()
    render(<StopSignButton sign={s.value} compact timer={hold().timer} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show the Stop Sign' }), { detail: 0 })
    expect(s.shown()).toBe(1)
  })
})
