/**
 * PhoneVitals: a row steps through the one vital control the header strip
 * shares (`useVitalControl`): − and + by one, stopping at the ends; a hold
 * repeats; the meter's keys run it to the ends; a counter has no meter.
 */
import { describe, expect, jest, mock, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { PhoneVital } from '../PhoneVitals'
import { PhoneVitals } from '../PhoneVitals'

function Live({ onSp = () => {} }: { onSp?: (next: number) => void }) {
  const vitals: PhoneVital[] = [
    { key: 'sp', label: 'SP', name: 'Structure Points', value: 5, max: 8, onChange: onSp },
    { key: 'upkeep', label: 'Upkeep', name: 'Upkeep', value: 3, note: 'Spent at Downtime' },
  ]
  return <PhoneVitals label="Custos vitals" vitals={vitals} foot={<p>Foot</p>} />
}

describe('PhoneVitals', () => {
  test('− and + step by one; a counter reads its note', () => {
    const onSp = mock((_next: number) => {})
    render(<Live onSp={onSp} />)
    fireEvent.click(screen.getByRole('button', { name: 'Increase Structure Points' }))
    fireEvent.click(screen.getByRole('button', { name: 'Decrease Structure Points' }))
    // Each counts from the step it asked for: 5 → 6 → 5.
    expect(onSp.mock.calls.map(([next]) => next)).toEqual([6, 5])
    expect(screen.getByText('Spent at Downtime')).toBeTruthy()
    expect(screen.getByText('Foot')).toBeTruthy()
  })

  test('the meter runs to its ends', () => {
    const onSp = mock((_next: number) => {})
    render(<Live onSp={onSp} />)
    const meter = screen.getByRole('slider', { name: 'Structure Points' })
    fireEvent.keyDown(meter, { key: 'End' })
    fireEvent.keyDown(meter, { key: 'Home' })
    expect(onSp.mock.calls.map(([next]) => next)).toEqual([8, 0])
  })

  test('a held press repeats', () => {
    const onSp = mock((_next: number) => {})
    render(<Live onSp={onSp} />)
    const minus = screen.getByRole('button', { name: 'Decrease Structure Points' })
    jest.useFakeTimers()
    try {
      fireEvent.pointerDown(minus)
      act(() => {
        jest.advanceTimersByTime(420 + 110)
      })
      fireEvent.pointerUp(minus)
      fireEvent.click(minus)
    } finally {
      jest.useRealTimers()
    }
    // The hold stepped twice (5 to 3); the click that ends it adds none.
    expect(onSp.mock.calls.map(([next]) => next)).toEqual([4, 3])
  })
})
