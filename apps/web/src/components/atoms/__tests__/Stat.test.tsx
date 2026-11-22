import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { Stat } from '../Stat'

describe('Stat', () => {
  test('reads label first, then value over its max', () => {
    const { container } = render(<Stat label="HP" value={10} max={12} />)
    const cell = container.querySelector('.su-stat-cell')
    expect(cell?.textContent).toBe('HP10/12')
    expect(cell?.firstElementChild?.textContent).toBe('HP')
  })

  test('hollow is an outline: the cell says so, a plain chip does not', () => {
    const { container } = render(<Stat label="Unassigned" hollow size="compact" />)
    expect(container.querySelector('.su-stat-cell--hollow')?.textContent).toBe('Unassigned')
    const plain = render(<Stat label="Only me" size="compact" />).container
    expect(plain.querySelector('.su-stat-cell--hollow')).toBeNull()
  })
})

describe('Stat stepper at its ceiling (r5 C6)', () => {
  test('the press that reaches the ceiling hands the focus to −', () => {
    function Count() {
      const [value, setValue] = useState(1)
      return (
        <Stat
          label="Tools"
          value={value}
          size="mini"
          mode="edit"
          ceiling={2}
          stepperLabel="Salvaging Tools"
          onChange={setValue}
        />
      )
    }
    render(<Count />)
    const plus = screen.getByRole('button', { name: 'Increase Salvaging Tools' })
    plus.focus()
    fireEvent.click(plus)
    expect(plus).toHaveProperty('disabled', true)
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Decrease Salvaging Tools' })
    )
  })
})
