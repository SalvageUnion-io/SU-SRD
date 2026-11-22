/** Browser Back closes an open picker and the sheet stays (r5 C5). */

import { describe, expect, test } from 'bun:test'
import { act, render } from '@testing-library/react'
import { useState } from 'react'
import { usePickerHistory } from '../pickerHistory'

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

  test('closed another way, it steps back over its entry', () => {
    const steps: number[] = []
    const back = window.history.back.bind(window.history)
    window.history.back = () => {
      steps.push(1)
    }
    try {
      const { container } = render(<Picker />)
      act(() => close?.())
      expect(container.textContent).toBe('closed')
      expect(steps).toEqual([1])
    } finally {
      window.history.back = back
    }
  })
})
