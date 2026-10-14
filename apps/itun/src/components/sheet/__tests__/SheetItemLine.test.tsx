/**
 * SheetItemLine — an item's controls on its Token's line: the condition is the
 * tri-state `StatusBadge` (as `MechItemToken`'s unresolved chit draws it), and
 * Uses is the horizontal `Stat` in edit mode, each held to the one control
 * height by its class (`.su-sheet-item__condition`, `.su-sheet-item__uses`).
 */
import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { SheetItemLine } from '../SheetItemLine'

const TOKEN = <span>Token</span>

describe('SheetItemLine — Edit', () => {
  test('the condition is the StatusBadge, which steps it on', () => {
    const onConditionCycle = mock(() => undefined)
    render(
      <SheetItemLine
        token={TOKEN}
        name="Data Scanner"
        condition="intact"
        readOnly={false}
        onConditionCycle={onConditionCycle}
      />
    )
    const badge = screen.getByRole('button', {
      name: 'Data Scanner status: Intact. Activate to mark Damaged',
    })
    expect(badge.closest('.su-sheet-item__condition')).toBeTruthy()
    fireEvent.click(badge)
    expect(onConditionCycle).toHaveBeenCalledTimes(1)
  })

  test('Uses is a label-first Stat with its steps, clamped to 0 and the max', () => {
    const onChange = mock((_next: number) => undefined)
    const { container } = render(
      <SheetItemLine
        token={TOKEN}
        name="First Aid Kit"
        readOnly={false}
        uses={{ remaining: 3, max: 3, onChange }}
      />
    )
    const cell = container.querySelector('.su-sheet-item__uses')
    expect(cell?.classList.contains('su-stat-cell')).toBe(true)
    expect(cell?.textContent).toBe('Uses3/3')
    const add = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Increase First Aid Kit uses',
    })
    expect(add.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Decrease First Aid Kit uses' }))
    expect(onChange).toHaveBeenCalledWith(2)
    expect(screen.getByRole('status').textContent).toBe('First Aid Kit uses: 3')
  })

  test('an item with no uses draws no Uses', () => {
    const { container } = render(
      <SheetItemLine
        token={TOKEN}
        name="Data Scanner"
        readOnly={false}
        uses={{ remaining: 0, max: 0, onChange: () => undefined }}
      />
    )
    expect(container.querySelector('.su-sheet-item__uses')).toBeNull()
  })
})

describe('SheetItemLine — Read', () => {
  test('intact, the Token alone', () => {
    const { container } = render(
      <SheetItemLine token={TOKEN} name="Data Scanner" condition="intact" readOnly />
    )
    expect(container.textContent).toBe('Token')
  })

  test('damaged, the StatusBadge reads it, with nothing to press', () => {
    render(<SheetItemLine token={TOKEN} name="Data Scanner" condition="damaged" readOnly />)
    expect(screen.getByText('Damaged')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
