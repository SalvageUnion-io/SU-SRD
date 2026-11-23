/**
 * MechSheetPickers — a search that names an item of the other kind (r8 E7):
 * Manage Systems searched for a Module says it is a Module and opens Manage
 * Modules on the same search, and the other way round.
 *
 * Conventions: no mock.module(), dep-injected store.
 */

import { describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { Mech } from 'game-domain/schemas/mech'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { makeSingleUnitStore } from '../../../components/__tests__/mockEntityStore'
import { MechSheet } from '../MechSheet'

const fakeChassis = {
  name: 'Iron Mongrel',
  structurePoints: 14,
  energyPoints: 6,
  heatCapacity: 8,
  systemSlots: 12,
  moduleSlots: 2,
  cargoCapacity: 4,
}

const mech: Mech = {
  id: 'mech-elsewhere-1',
  schemaVersion: 1,
  name: 'Elsewhere Mech',
  chassisRef: 'iron-mongrel',
  systems: [],
  modules: [],
  cargoLots: [],
  conditions: [],
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
}

function renderSheet() {
  const update = mock(async (_t: string, _id: string, patch: Partial<Mech>) => ({
    ...mech,
    ...patch,
  }))
  const store = makeSingleUnitStore('mech', () => mech, { update })
  render(<MechSheet mech={mech} chassis={fakeChassis} store={store} />)
}

describe('MechSheetPickers — the other kind’s item', () => {
  test('Manage Systems searched for a Module points to Manage Modules, on the same search', async () => {
    renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Manage Systems' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
      target: { value: 'Comms Module' },
    })
    expect(screen.getByText('Comms Module is a Module.')).toBeDefined()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Find it in Modules' }))
    })
    expect(screen.getByRole('heading', { name: 'Manage Modules' })).toBeDefined()
    const search = screen.getByRole<HTMLInputElement>('textbox', { name: 'Search' })
    expect(search.value).toBe('Comms Module')
  })

  test('a search this kind names says nothing of the other', () => {
    renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Manage Systems' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
      target: { value: 'Cargo' },
    })
    expect(screen.queryByRole('button', { name: 'Find it in Modules' })).toBeNull()
  })
})
