/**
 * Strip: a live vital's meter is a slider. Its arrow keys step the number, Home
 * and End run it to the ends, and a tap on a segment sets it (a lit segment
 * clears from there, an unlit one fills up to it), always inside 0..max. Writes
 * are server-first, so every step counts from the last value it asked for until
 * the store catches up: fast taps never lose a step (`useVitalControl`).
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
    // The store never answers here, so each key counts from the one before.
    expect(onChange.mock.calls.map(([next]) => next)).toEqual([4, 5, 4, 3, 0, 5])
  })

  test('a step never leaves 0..max', () => {
    const { slider, onChange } = renderVital({ value: 5 })
    fireEvent.keyDown(slider, { key: 'ArrowUp' })
    expect(onChange).not.toHaveBeenCalled()
  })

  test('two fast taps on + step twice before the store answers, and once it does', () => {
    const { view, onChange } = renderVital()
    const plus = view.getByRole('button', { name: 'Increase Structure Points' })
    fireEvent.click(plus)
    fireEvent.click(plus)
    expect(onChange.mock.calls.map(([next]) => next)).toEqual([4, 5])
    // The store catches up to the first step: the next tap still counts from 5.
    const vital: PhoneVital = {
      key: 'sp',
      label: 'SP',
      name: 'Structure Points',
      value: 4,
      max: 6,
      onChange,
    }
    view.rerender(<Strip label="Mazona vitals" vitals={[vital]} />)
    fireEvent.click(plus)
    expect(onChange).toHaveBeenLastCalledWith(6)
  })

  test('in Edit the max is a field a press away, and an override reverts', () => {
    const onMaxChange = mock((_next: number) => {})
    const onRevertOverride = mock(() => {})
    const { view } = renderVital({
      maxEdit: { onMaxChange, onRevertOverride, breakdown: { overridden: true, derived: 4 } },
    })
    fireEvent.click(view.getByRole('button', { name: 'Override SP max (currently 5)' }))
    const field = view.getByRole('spinbutton', { name: 'Set SP max' })
    fireEvent.change(field, { target: { value: '7' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(onMaxChange).toHaveBeenCalledWith(7)
    fireEvent.click(view.getByRole('button', { name: 'Revert SP max to derived 4' }))
    expect(onRevertOverride).toHaveBeenCalled()
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
