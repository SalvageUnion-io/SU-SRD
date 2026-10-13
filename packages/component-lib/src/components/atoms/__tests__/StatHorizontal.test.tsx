import { describe, expect, test } from 'bun:test'
import { render, within } from '@testing-library/react'
import { Stat } from '../Stat'

// The horizontal anatomy (formerly ValueDisplay): the black/white [label | value] chip.
describe('Stat (horizontal)', () => {
  test('renders label', () => {
    const { container } = render(<Stat orientation="horizontal" label="SP" />)
    expect(within(container).getByText('SP')).toBeTruthy()
  })

  test('renders label and value', () => {
    const { container } = render(<Stat orientation="horizontal" label="SP" value={10} />)
    expect(within(container).getByText('SP')).toBeTruthy()
    expect(within(container).getByText('10')).toBeTruthy()
  })

  test('does not render value when undefined', () => {
    const { container } = render(<Stat orientation="horizontal" label="SP" />)
    const spans = container.querySelectorAll('span > span')
    expect(spans.length).toBe(1)
  })

  test('renders compact variant with smaller text', () => {
    const { container } = render(
      <Stat orientation="horizontal" label="SP" value={5} size="compact" />
    )
    const label = within(container).getByText('SP')
    expect(label.style.fontSize).toBe('0.75rem')
  })

  test('renders string values', () => {
    const { container } = render(<Stat orientation="horizontal" label="Range" value="Close" />)
    expect(within(container).getByText('Range')).toBeTruthy()
    expect(within(container).getByText('Close')).toBeTruthy()
  })

  test('`wrap` lets a long value wrap inside a cell that may narrow; the label stays one line', () => {
    const { container } = render(
      <Stat orientation="horizontal" label="REQ" value="Augmentation or Gladiatorial" wrap />
    )
    const cell = container.querySelector<HTMLElement>('.su-stat-cell')
    expect(cell?.classList.contains('su-stat-cell--wrap')).toBe(true)
    expect(cell?.style.whiteSpace).toBe('normal')
    expect(cell?.style.minWidth).toBe('0')
    expect(within(container).getByText('REQ').style.whiteSpace).toBe('nowrap')
  })

  test('without `wrap` the cell keeps its value on one line', () => {
    const { container } = render(<Stat orientation="horizontal" label="Range" value="Close" />)
    const cell = container.querySelector<HTMLElement>('.su-stat-cell')
    expect(cell?.classList.contains('su-stat-cell--wrap')).toBe(false)
    expect(cell?.style.whiteSpace).toBe('nowrap')
  })
})
