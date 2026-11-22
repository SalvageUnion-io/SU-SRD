/** NumeralField — a count typed, not tapped (r6 E18). */
import { describe, expect, it } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { NumeralField } from '../NumeralField'
import { Stat } from '../Stat'

describe('NumeralField', () => {
  it('opens a field on a press; 8 and Enter set 8', () => {
    const set: number[] = []
    render(<NumeralField label="T1 Scrap" value={0} onSet={(n) => set.push(n)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Set T1 Scrap (now 0)' }))
    const field = screen.getByRole('spinbutton', { name: 'Set T1 Scrap' })
    fireEvent.change(field, { target: { value: '8' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(set).toEqual([8])
    expect(screen.queryByRole('spinbutton')).toBeNull()
  })

  it('keeps the count on Escape, and holds a typed number inside its bounds', () => {
    const set: number[] = []
    render(<NumeralField label="TP" value={3} max={5} onSet={(n) => set.push(n)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Set TP (now 3)' }))
    const field = screen.getByRole('spinbutton', { name: 'Set TP' })
    fireEvent.change(field, { target: { value: '9' } })
    fireEvent.keyDown(field, { key: 'Escape' })
    expect(set).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Set TP (now 3)' }))
    const again = screen.getByRole('spinbutton', { name: 'Set TP' })
    fireEvent.change(again, { target: { value: '9' } })
    fireEvent.blur(again)
    expect(set).toEqual([5])
  })

  it('is a typeable Stat’s value in edit, beside its − and +', () => {
    const set: number[] = []
    render(
      <Stat
        label="T1"
        value={2}
        mode="edit"
        typeable
        stepperLabel="T1 Scrap"
        onChange={(n) => set.push(n)}
      />
    )
    expect(screen.getByRole('button', { name: 'Increase T1 Scrap' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Set T1 Scrap (now 2)' }))
    const field = screen.getByRole('spinbutton', { name: 'Set T1 Scrap' })
    fireEvent.change(field, { target: { value: '8' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(set).toEqual([8])
  })
})
