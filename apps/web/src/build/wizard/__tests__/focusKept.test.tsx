/**
 * r8 F4 (SB8-20): a press that disables its own button hands the focus to the
 * next live control, never to the page.
 */
import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { nextLiveControl, useFocusKeptOnDisable } from '../focusKept'

function Picks() {
  useFocusKeptOnDisable()
  const [count, setCount] = useState(1)
  const full = count >= 2
  return (
    <div>
      <button type="button" disabled={full} onClick={() => setCount(count + 1)}>
        Increase
      </button>
      <button type="button" disabled>
        Locked
      </button>
      <a href="#next">Skip to Next</a>
    </div>
  )
}

describe('nextLiveControl', () => {
  test('skips a disabled button and a hidden control, and finds what follows', () => {
    document.body.innerHTML =
      '<button id="a">A</button><button disabled>B</button><div hidden><a href="#">C</a></div><input id="d" />'
    const a = document.getElementById('a') as Element
    expect(nextLiveControl(a)?.id).toBe('d')
    expect(nextLiveControl(document.getElementById('d') as Element)).toBeNull()
  })
})

describe('useFocusKeptOnDisable', () => {
  test('the pick that disables its own button passes the focus on', async () => {
    render(<Picks />)
    const increase = screen.getByRole('button', { name: 'Increase' })
    increase.focus()
    expect(document.activeElement).toBe(increase)
    // The observer answers in a microtask, flushed with the click's act.
    await act(async () => {
      fireEvent.click(increase)
    })
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Skip to Next' }))
  })
})
