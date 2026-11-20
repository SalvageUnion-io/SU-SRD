/**
 * Strip: a live vital's meter is a slider. Its arrow keys step the number, Home
 * and End run it to the ends, and a tap on a segment sets it (a lit segment
 * clears from there, an unlit one fills up to it), always inside 0..max.
 */
import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render } from '@testing-library/react'
import type { PhoneVital } from '../PhoneVitals'
import { Strip } from '../Strip'

function renderVital(over: Partial<PhoneVital> = {}) {
  const onChange = mock((_next: number) => {})
  const vital: PhoneVital = {
    key: 'sp',
    label: 'SP',
    name: 'Structure Points',
    value: 3,
    max: 5,
    onChange,
    ...over,
  }
  const view = render(<Strip label="Mazona vitals" vitals={[vital]} />)
  const slider = view.getByRole('slider', { name: 'Structure Points' })
  return { view, slider, onChange }
}

describe("a live vital's meter", () => {
  test('arrow keys step it by one, Home and End run it to the ends', () => {
    const { slider, onChange } = renderVital()
    for (const key of ['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'Home', 'End']) {
      fireEvent.keyDown(slider, { key })
    }
    expect(onChange.mock.calls.map(([next]) => next)).toEqual([4, 4, 2, 2, 0, 5])
  })

  test('a step never leaves 0..max', () => {
    const { slider, onChange } = renderVital({ value: 5 })
    fireEvent.keyDown(slider, { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith(5)
  })

  test('any other key does nothing', () => {
    const { slider, onChange } = renderVital()
    fireEvent.keyDown(slider, { key: 'a' })
    expect(onChange).not.toHaveBeenCalled()
  })

  test('a lit segment clears from there; an unlit one fills up to it', () => {
    const { slider, onChange } = renderVital()
    const segs = slider.querySelectorAll('[data-pip-index]')
    fireEvent.click(segs[1] as Element)
    fireEvent.click(segs[4] as Element)
    expect(onChange.mock.calls.map(([next]) => next)).toEqual([1, 5])
  })

  test('a tap between segments does nothing', () => {
    const { slider, onChange } = renderVital()
    fireEvent.click(slider)
    expect(onChange).not.toHaveBeenCalled()
  })

  test('without onChange it is a picture of the number, not a slider', () => {
    const vital: PhoneVital = { key: 'sp', label: 'SP', name: 'Structure Points', value: 3, max: 5 }
    const view = render(<Strip label="Mazona vitals" vitals={[vital]} />)
    expect(view.queryByRole('slider')).toBeNull()
    expect(view.getByRole('img', { name: 'Structure Points 3 of 5' })).toBeDefined()
  })
})
