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
        chosenLabel="Chosen"
        railActions={<button type="button">Apply chassis</button>}
      />
    )
    const bar = rail('Chosen')
    expect(within(bar).getByTestId('rail-entry').textContent).toBe(chassis.name)
    expect(bar.querySelector('[aria-expanded]')).toBeNull()
    expect(within(bar).getByRole('button', { name: 'Apply chassis' })).toBeTruthy()
    // Every chassis card in the results renders too: 1.6 s alone, past the
    // default 5 s with the pre-push gates and every workspace in parallel.
  }, 30_000)
})
