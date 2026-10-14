/**
 * CargoLotRow — the one way a cargo lot is drawn: its name as plain text that
 * wraps, then label-first chips (`UNITS | n`, `TL | n` where it has one, `QTY |
 * n` for a bulk lot whose count is not its units), then the host's buttons.
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { CargoLotRow } from '../CargoLotRow'

/** The row's chips, as `LABEL value` strings. */
function chips(): string[] {
  return [...screen.getByRole('listitem').querySelectorAll('.su-stat-cell')].map((cell) =>
    [...cell.children].map((part) => part.textContent).join(' ')
  )
}

function renderRow(lot: Parameters<typeof CargoLotRow>[0]['lot'], children?: React.ReactNode) {
  return render(
    <ul>
      <CargoLotRow lot={lot}>{children}</CargoLotRow>
    </ul>
  )
}

describe('CargoLotRow', () => {
  test('a plain lot: its name, then UNITS', () => {
    renderRow({ name: 'Sealed Crate', units: 3, kind: 'unit' })
    const name = screen.getByText('Sealed Crate')
    // A name, not a stamp, and it wraps rather than cutting to "…" (E18).
    expect(name.className).not.toContain('stamp')
    expect(name.style.textOverflow).toBe('')
    expect(name.style.whiteSpace).toBe('')
    expect(chips()).toEqual(['Units 3'])
  })

  test('a lot with a Tech Level adds its TL chip', () => {
    renderRow({ name: 'Circuitry', units: 1, tl: 3, kind: 'unit' })
    expect(chips()).toEqual(['Units 1', 'TL 3'])
  })

  test('a bulk lot shows QTY only when its count is not its units', () => {
    renderRow({ name: 'T2 Scrap', units: 6, qty: 6, tl: 2, kind: 'bulk' })
    expect(chips()).toEqual(['Units 6', 'TL 2'])
  })

  test('a bulk lot counted apart from its units reads both', () => {
    renderRow({ name: 'Rations', units: 2, qty: 10, kind: 'bulk' })
    expect(chips()).toEqual(['Units 2', 'Qty 10'])
  })

  test("no rail: the row's frame carries no inset colour", () => {
    renderRow({ name: 'Sealed Crate', units: 3 })
    expect(screen.getByRole('listitem').style.boxShadow).toBe('')
  })

  test("the host's buttons follow the chips", () => {
    renderRow({ name: 'Sealed Crate', units: 3 }, <button type="button">Jettison</button>)
    const row = screen.getByRole('listitem')
    expect(row.lastElementChild?.textContent).toBe('Jettison')
  })
})
