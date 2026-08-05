import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { SlotGrid } from '../SlotGrid'

describe('SlotGrid', () => {
  test('renders one cell per capacity slot; empties are dashed', () => {
    const { container } = render(<SlotGrid used={2} cap={6} />)
    const cells = container.querySelectorAll('[aria-hidden="true"]')
    expect(cells.length).toBe(6)
    const filled = Array.from(cells).filter((c) => c.className.includes('bg-cargo'))
    const empty = Array.from(cells).filter((c) => c.className.includes('border-dashed'))
    expect(filled.length).toBe(2)
    expect(empty.length).toBe(4)
  })

  test('over capacity adds status-bad cells and flags the accessible label', () => {
    const { container } = render(<SlotGrid used={8} cap={6} />)
    const cells = container.querySelectorAll('[aria-hidden="true"]')
    expect(cells.length).toBe(8)
    const over = Array.from(cells).filter((c) => c.className.includes('bg-status-bad'))
    expect(over.length).toBe(2)
    expect(screen.getByLabelText(/over capacity/i)).toBeTruthy()
  })
})
