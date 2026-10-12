import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { color } from '../../../design/tokens'
import { SlotGrid } from '../SlotGrid'

const cellsOf = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>('[aria-hidden="true"]'))

describe('SlotGrid', () => {
  test('renders one cell per capacity slot; empties are dashed', () => {
    const { container } = render(<SlotGrid used={2} cap={6} />)
    const cells = cellsOf(container)
    expect(cells.length).toBe(6)
    const filled = cells.filter((c) => c.style.backgroundColor === color.cargo)
    const empty = cells.filter((c) => c.style.borderStyle === 'dashed')
    expect(filled.length).toBe(2)
    expect(empty.length).toBe(4)
  })

  test('over capacity adds status-bad cells and flags the accessible label', () => {
    const { container } = render(<SlotGrid used={8} cap={6} />)
    const cells = cellsOf(container)
    expect(cells.length).toBe(8)
    const over = cells.filter((c) => c.style.backgroundColor === color.statusBad)
    expect(over.length).toBe(2)
    expect(screen.getByLabelText(/over capacity/i)).toBeTruthy()
  })
})
