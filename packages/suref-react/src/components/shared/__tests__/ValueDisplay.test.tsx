import { describe, test, expect } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { ValueDisplay } from '../ValueDisplay'

describe('ValueDisplay', () => {
  test('renders label', () => {
    render(<ValueDisplay label="SP" />)
    expect(screen.getByText('SP')).toBeTruthy()
  })

  test('renders label and value', () => {
    render(<ValueDisplay label="SP" value={10} />)
    expect(screen.getByText('SP')).toBeTruthy()
    expect(screen.getByText('10')).toBeTruthy()
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
    render(<ValueDisplay label="Range" value="Close" />)
    expect(screen.getByText('Range')).toBeTruthy()
    expect(screen.getByText('Close')).toBeTruthy()
  })
})
