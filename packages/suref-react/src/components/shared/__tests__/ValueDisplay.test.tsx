import { describe, test, expect } from 'bun:test'
import { render, within } from '@testing-library/react'
import { ValueDisplay } from '../ValueDisplay'

describe('ValueDisplay', () => {
  test('renders label', () => {
    const { container } = render(<ValueDisplay label="SP" />)
    expect(within(container).getByText('SP')).toBeTruthy()
  })

  test('renders label and value', () => {
    const { container } = render(<ValueDisplay label="SP" value={10} />)
    expect(within(container).getByText('SP')).toBeTruthy()
    expect(within(container).getByText('10')).toBeTruthy()
  })

  test('does not render value when undefined', () => {
    const { container } = render(<ValueDisplay label="SP" />)
    const spans = container.querySelectorAll('span > span')
    expect(spans.length).toBe(1)
  })

  test('renders compact variant with smaller text', () => {
    const { container } = render(<ValueDisplay label="SP" value={5} compact />)
    const textElements = container.querySelectorAll('.text-xs')
    expect(textElements.length).toBeGreaterThan(0)
  })

  test('renders string values', () => {
    const { container } = render(<ValueDisplay label="Range" value="Close" />)
    expect(within(container).getByText('Range')).toBeTruthy()
    expect(within(container).getByText('Close')).toBeTruthy()
  })
})
