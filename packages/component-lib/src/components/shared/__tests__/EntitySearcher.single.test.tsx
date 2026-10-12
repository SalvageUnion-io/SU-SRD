/**
 * EntitySearcher — single mode. Split from EntitySearcher.test.tsx (the suite's
 * contract and the narrow-viewport note are there) so the parallel runner can
 * spread the pool renders over its workers.
 */

import { describe, expect, it } from 'bun:test'
import { render, within } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntitySearcher } from '../EntitySearcher'
import { rail } from './entitySearcherHarness'

describe('EntitySearcher — single mode', () => {
  it('is a one-line bar: the chosen name and the confirm actions, nothing to fold', () => {
    const chassis = SalvageUnionReference.Chassis.all()[0]
    if (!chassis) throw new Error('No chassis in reference data')
    render(
      <EntitySearcher
        schema="chassis"
        mode="single"
        selected={[chassis.id]}
        onToggle={() => {}}
        idOf={(i) => i.id}
        // The bar is the subject; a pool of every chassis card took ~5 s to
        // render on a 4-core runner, the whole default budget.
        filter={(i) => i.id === chassis.id}
        chosenLabel="Chosen"
        railActions={<button type="button">Apply chassis</button>}
      />
    )
    const bar = rail('Chosen')
    expect(within(bar).getByTestId('rail-entry').textContent).toBe(chassis.name)
    expect(bar.querySelector('[aria-expanded]')).toBeNull()
    expect(within(bar).getByRole('button', { name: 'Apply chassis' })).toBeTruthy()
  })
})
