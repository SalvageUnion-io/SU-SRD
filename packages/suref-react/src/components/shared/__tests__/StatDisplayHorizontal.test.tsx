import { describe, test, expect } from 'bun:test'
import { render, within } from '@testing-library/react'
import { StatDisplay } from '../StatDisplay'

// The horizontal anatomy (formerly ValueDisplay): the black/white [label | value] chip.
describe('StatDisplay (horizontal)', () => {
  test('renders label', () => {
    const { container } = render(<StatDisplay orientation="horizontal" label="SP" />)
    expect(within(container).getByText('SP')).toBeTruthy()
  })

  test('renders label and value', () => {
    const { container } = render(<StatDisplay orientation="horizontal" label="SP" value={10} />)
    expect(within(container).getByText('SP')).toBeTruthy()
    expect(within(container).getByText('10')).toBeTruthy()
  })

  test('does not render value when undefined', () => {
    const { container } = render(<StatDisplay orientation="horizontal" label="SP" />)
    const spans = container.querySelectorAll('span > span')
    expect(spans.length).toBe(1)
  })

  test('renders compact variant with smaller text', () => {
    const { container } = render(
      <StatDisplay orientation="horizontal" label="SP" value={5} compact />
    )
    const textElements = container.querySelectorAll('.text-xs')
    expect(textElements.length).toBeGreaterThan(0)
  })

  test('renders string values', () => {
    const { container } = render(
      <StatDisplay orientation="horizontal" label="Range" value="Close" />
    )
    expect(within(container).getByText('Range')).toBeTruthy()
    expect(within(container).getByText('Close')).toBeTruthy()
  })
})
