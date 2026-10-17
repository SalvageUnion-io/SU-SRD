/**
 * EntitySearcher — single mode. Split from EntitySearcher.test.tsx (the suite's
 * contract and the viewport note are there) so the parallel runner can spread
 * the pool renders over its workers.
 */

import { describe, expect, it } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntitySearcher } from '../EntitySearcher'
import { rail } from './entitySearcherHarness'

describe('EntitySearcher — single mode', () => {
  it('is a radio group; the chosen one has no Remove, and the rail carries the confirm actions', () => {
    const [chosen, other] = SalvageUnionReference.Chassis.all()
    if (!chosen || !other) throw new Error('Need two chassis in reference data')
    const toggled: string[] = []
    render(
      <EntitySearcher
        schema="chassis"
        mode="single"
        selected={[chosen.id]}
        onToggle={(ref) => toggled.push(ref)}
        idOf={(i) => i.id}
        // A pool of every chassis took ~5 s to render on a 4-core runner, the
        // whole default budget; two make the point.
        filter={(i) => i.id === chosen.id || i.id === other.id}
        chosenLabel="Chosen"
        title="Change Chassis"
        onClose={() => {}}
        railActions={<button type="button">Apply chassis</button>}
      />
    )
    const group = screen.getByRole('radiogroup', { name: 'Change Chassis' })
    const radio = within(group).getByRole('radio', { name: `Select ${chosen.name}` })
    expect(radio.getAttribute('aria-checked')).toBe('true')

    const bar = rail(/chosen/i)
    expect(
      within(within(bar).getByTestId('rail-entry')).getByRole('button', { name: chosen.name })
    ).toBeTruthy()
    expect(within(bar).queryByRole('button', { name: /^Remove/ })).toBeNull()
    // The caller's actions replace DONE.
    expect(within(bar).getByRole('button', { name: 'Apply chassis' })).toBeTruthy()
    expect(within(bar).queryByRole('button', { name: 'Done' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: other.name }))
    fireEvent.click(
      within(screen.getByRole('group', { name: `${other.name} actions` })).getByRole('button', {
        name: 'Choose',
      })
    )
    expect(toggled).toEqual([other.id])
  })
})
