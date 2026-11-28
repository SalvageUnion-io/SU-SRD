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

  test('perRow sets the rows (six slots 3 × 2), never past six; mini cells are small', () => {
    const { container } = render(<SlotGrid used={5} cap={6} perRow={3} size="mini" />)
    const rows = Array.from(container.querySelectorAll('[role="img"] > span'))
    expect(rows.map((row) => row.children.length)).toEqual([3, 3])
    expect(cellsOf(container)[0]?.style.width).toBe('12px')
    const wide = render(<SlotGrid used={0} cap={12} perRow={9} />)
    const wideRows = Array.from(wide.container.querySelectorAll('[role="img"] > span'))
    expect(wideRows.map((row) => row.children.length)).toEqual([6, 6])
  })

  test('a given label keeps the over-capacity flag', () => {
    render(<SlotGrid used={7} cap={6} label="Inventory" />)
    expect(screen.getByRole('img', { name: 'Inventory — over capacity' })).toBeTruthy()
  })
})
