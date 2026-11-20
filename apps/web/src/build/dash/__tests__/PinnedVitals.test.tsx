/**
 * PinnedVitals: a phone's vitals pinned over the dash. The glance row reads
 * each gauge; a press opens the rows (PhoneVitals) under it, where − | +,
 * the meter's keys and a tap on a segment step the number, clamped to its
 * range. A read-only unit's glance is a read-out.
 */

import { describe, expect, jest, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { must } from '../../../components/__tests__/must'
import type { PhoneVital } from '../../../components/index'
import { PinnedVitals } from '../Dash'

/** A live unit: SP 5 of 8 and Heat 2 of 6 (redline from 4), plus a counter. */
function Live({ onSp }: { onSp?: (next: number) => void }) {
  const [sp, setSp] = useState(5)
  const [heat, setHeat] = useState(2)
  const vitals: PhoneVital[] = [
    {
      key: 'sp',
      label: 'SP',
      name: 'Structure Points',
      value: sp,
      max: 8,
      onChange: (next) => {
        onSp?.(next)
        setSp(next)
      },
    },
    {
      key: 'heat',
      label: 'Heat',
      name: 'Heat',
      value: heat,
      max: 6,
      danger: 4,
      onChange: setHeat,
    },
    { key: 'tp', label: 'TP', name: 'Training Points', value: 3, note: 'Spent at Downtime' },
  ]
  return <PinnedVitals label="Custos vitals" name="Custos" vitals={vitals} foot={<p>Foot</p>} />
}

describe('PinnedVitals', () => {
  test('the glance reads each gauge and opens the rows under it', () => {
    render(<Live />)
    const sp = screen.getByRole('button', { name: 'Structure Points 5 of 8. Change' })
    expect(sp.getAttribute('aria-expanded')).toBe('false')
    // The counter has no gauge, so it shows only in the rows.
    expect(screen.queryByRole('group', { name: 'Custos vitals' })).toBeNull()

    fireEvent.click(sp)
    const rows = screen.getByRole('group', { name: 'Custos vitals' })
    expect(within(rows).getByText('Spent at Downtime')).toBeTruthy()
    expect(within(rows).getByText('Foot')).toBeTruthy()
    expect(sp.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(sp)
    expect(screen.queryByRole('group', { name: 'Custos vitals' })).toBeNull()
  })

  test('− and + step by one, and stop at the ends', () => {
    const onSp = mock((_next: number) => {})
    render(<Live onSp={onSp} />)
    fireEvent.click(screen.getByRole('button', { name: /Structure Points 5 of 8/ }))

    fireEvent.click(screen.getByRole('button', { name: 'Increase Structure Points' }))
    expect(onSp).toHaveBeenLastCalledWith(6)
    fireEvent.click(screen.getByRole('button', { name: 'Decrease Structure Points' }))
    expect(onSp).toHaveBeenLastCalledWith(5)

    const meter = screen.getByRole('slider', { name: 'Structure Points' })
    fireEvent.keyDown(meter, { key: 'End' })
    expect(meter.getAttribute('aria-valuenow')).toBe('8')
    expect(
      (screen.getByRole('button', { name: 'Increase Structure Points' }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
    fireEvent.keyDown(meter, { key: 'Home' })
    expect(meter.getAttribute('aria-valuenow')).toBe('0')
    expect(
      (screen.getByRole('button', { name: 'Decrease Structure Points' }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
    fireEvent.keyDown(meter, { key: 'ArrowUp' })
    fireEvent.keyDown(meter, { key: 'ArrowRight' })
    expect(meter.getAttribute('aria-valuenow')).toBe('2')
    fireEvent.keyDown(meter, { key: 'ArrowDown' })
    expect(meter.getAttribute('aria-valuenow')).toBe('1')
    // A key the meter does not use leaves it alone.
    fireEvent.keyDown(meter, { key: 'a' })
    expect(meter.getAttribute('aria-valuenow')).toBe('1')
  })

  test('a tap on a segment sets the value', () => {
    render(<Live />)
    fireEvent.click(screen.getByRole('button', { name: /Heat 2 of 6/ }))
    const meter = screen.getByRole('slider', { name: 'Heat' })
    const segment = must(meter.querySelector('[data-pip-index="4"]')) as HTMLElement
    fireEvent.click(segment)
    expect(meter.getAttribute('aria-valuenow')).toBe('5')
    // Past its redline, the glance reads hot.
    const heat = screen.getByRole('button', { name: /Heat 5 of 6/ })
    expect(heat.hasAttribute('data-hot')).toBe(true)
  })

  test('a held press repeats', () => {
    const onSp = mock((_next: number) => {})
    render(<Live onSp={onSp} />)
    fireEvent.click(screen.getByRole('button', { name: /Structure Points 5 of 8/ }))
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

  test('a read-only unit’s glance is a read-out', () => {
    render(
      <PinnedVitals
        label="Read-only vitals"
        vitals={[{ key: 'sp', label: 'SP', name: 'Structure Points', value: 3, max: 8 }]}
      />
    )
    const cell = screen.getByRole('button', { name: /Structure Points 3 of 8/ })
    expect((cell as HTMLButtonElement).disabled).toBe(true)
  })
})
