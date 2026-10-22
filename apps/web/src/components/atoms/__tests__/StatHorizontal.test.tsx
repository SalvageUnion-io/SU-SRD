import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { Stat } from '../Stat'

// The horizontal anatomy: the black/white [label | value] chip.
describe('Stat (horizontal)', () => {
  test('renders label', () => {
    const { container } = render(<Stat label="SP" />)
    expect(within(container).getByText('SP')).toBeTruthy()
  })

  test('renders label and value', () => {
    const { container } = render(<Stat label="SP" value={10} />)
    expect(within(container).getByText('SP')).toBeTruthy()
    expect(within(container).getByText('10')).toBeTruthy()
  })

  test('does not render value when undefined', () => {
    const { container } = render(<Stat label="SP" />)
    const spans = container.querySelectorAll('span > span')
    expect(spans.length).toBe(1)
  })

  test('renders compact variant with smaller text', () => {
    const { container } = render(<Stat label="SP" value={5} size="compact" />)
    // The plate's type rides its rung class (`.su-stat-plate--compact`: `text-xs`).
    const label = within(container).getByText('SP')
    expect(label.classList).toContain('su-stat-plate--compact')
  })

  test('renders string values', () => {
    const { container } = render(<Stat label="Range" value="Close" />)
    expect(within(container).getByText('Range')).toBeTruthy()
    expect(within(container).getByText('Close')).toBeTruthy()
  })

  test('`wrap` lets a long value wrap inside a cell that may narrow; the label stays one line', () => {
    const { container } = render(<Stat label="REQ" value="Augmentation or Gladiatorial" wrap />)
    const cell = container.querySelector<HTMLElement>('.su-stat-cell')
    // `.su-stat-cell--wrap` lets the cell wrap and narrow; `.su-stat-plate--wrap`
    // lets the value break; the label plate (`--label`) holds one line.
    expect(cell?.classList.contains('su-stat-cell--wrap')).toBe(true)
    expect(within(container).getByText('Augmentation or Gladiatorial').classList).toContain(
      'su-stat-plate--wrap'
    )
    expect(within(container).getByText('REQ').classList).toContain('su-stat-plate--label')
  })

  test('without `wrap` the cell keeps its value on one line', () => {
    const { container } = render(<Stat label="Range" value="Close" />)
    const cell = container.querySelector<HTMLElement>('.su-stat-cell')
    expect(cell?.classList.contains('su-stat-cell--wrap')).toBe(false)
    expect(within(container).getByText('Close').classList).not.toContain('su-stat-plate--wrap')
  })

  test('edit mode: the one stepper, its `ceiling` an unprinted cap, its press kept from the host', () => {
    const changes: number[] = []
    let hostClicks = 0
    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: a stand-in for a picker card's click
      // biome-ignore lint/a11y/useKeyWithClickEvents: a stand-in for a picker card's click
      <div onClick={() => hostClicks++}>
        <Stat
          label="Qty"
          value={1}
          ceiling={1}
          mode="edit"
          onChange={(n) => changes.push(n)}
          stepperLabel="Med Kit count"
        />
      </div>
    )
    const plus = screen.getByRole<HTMLButtonElement>('button', { name: 'Increase Med Kit count' })
    expect(plus.disabled).toBe(true)
    expect(screen.queryByText('/1')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Decrease Med Kit count' }))
    expect(changes).toEqual([0])
    expect(hostClicks).toBe(0)
  })
})
