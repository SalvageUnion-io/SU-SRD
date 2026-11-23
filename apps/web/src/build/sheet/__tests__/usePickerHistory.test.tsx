/** Browser Back closes an open picker and the sheet stays (r5 C5). */

import { describe, expect, test } from 'bun:test'
import { act, render } from '@testing-library/react'
import { StrictMode, useState } from 'react'
import { usePickerHistory } from '../usePickerHistory'

let close: (() => void) | undefined

function Picker() {
  const [open, setOpen] = useState(true)
  close = () => setOpen(false)
  usePickerHistory(open, () => setOpen(false))
  return <p>{open ? 'open' : 'closed'}</p>
}

describe('usePickerHistory', () => {
  test('an open picker holds one entry, and Back closes it', () => {
    const { container } = render(<Picker />)
    expect((window.history.state as Record<string, unknown>).suPicker).toBe(true)
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
    })
    expect(container.textContent).toBe('closed')
  })

  test('closed another way, it steps back over its entry', async () => {
    const steps: number[] = []
    const back = window.history.back.bind(window.history)
    window.history.back = () => {
      steps.push(1)
    }
    try {
      const { container } = render(<Picker />)
      await act(async () => close?.())
      expect(container.textContent).toBe('closed')
      expect(steps).toEqual([1])
    } finally {
      window.history.back = back
    }
  })

  // r7 D4 (SB7-11): Play's Spend TP mounts the picker open; React's StrictMode
  // runs the effect twice on mount, and the first run's Back closed it at once.
  test('mounted open and its effect run again at once, it keeps one entry and stays open', async () => {
    const steps: number[] = []
    const back = window.history.back.bind(window.history)
    const push = window.history.pushState.bind(window.history)
    let pushes = 0
    window.history.back = () => {
      steps.push(1)
    }
    window.history.pushState = (...args: Parameters<History['pushState']>) => {
      pushes += 1
      push(...args)
    }
    try {
      const { container } = render(
        <StrictMode>
          <Picker />
        </StrictMode>
      )
      await act(async () => {
        await Promise.resolve()
      })
      expect(container.textContent).toBe('open')
      expect(steps).toEqual([])
      expect(pushes).toBe(1)
      expect((window.history.state as Record<string, unknown>).suPicker).toBe(true)
    } finally {
      window.history.back = back
      window.history.pushState = push
    }
  })
})
