/** A hold's intake: Enter in any field loads, and the next lot starts in the name (r5 C4). */

import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import type { CargoLot } from 'game-domain/schemas/cargoLot'
import { HoldAdder } from '../HoldAdder'

function adder() {
  const added: CargoLot[] = []
  render(<HoldAdder onAdd={(lot) => added.push(lot)} verb="Load" containerLabel="the hold" />)
  const name = screen.getByRole('textbox', { name: 'New cargo name' })
  const slots = screen.getByRole('spinbutton', { name: 'New cargo slot cost' })
  return { added, name, slots }
}

describe('HoldAdder', () => {
  test('Enter in the slot cost loads the lot, and focus goes back to the name', () => {
    const { added, name, slots } = adder()
    fireEvent.change(name, { target: { value: 'Crate' } })
    fireEvent.change(slots, { target: { value: '3' } })
    fireEvent.keyDown(slots, { key: 'Enter' })
    expect(added).toHaveLength(1)
    expect(added[0]?.name).toBe('Crate')
    expect(document.activeElement).toBe(name)
  })

  test('pressing Load puts the focus back in the name too', () => {
    const { added, name } = adder()
    fireEvent.change(name, { target: { value: 'Crate' } })
    fireEvent.click(screen.getByRole('button', { name: /Load/ }))
    expect(added).toHaveLength(1)
    expect(document.activeElement).toBe(name)
  })
})
