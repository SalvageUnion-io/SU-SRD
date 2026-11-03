/**
 * PartnerMini — a companion on the pilot sheet is a Mini (EDL level 2); its
 * loadout and controls live on its Page, opened from Details in both states.
 *
 * Conventions: toBeTruthy() not toBeInTheDocument(), dep-injected store.
 */

import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import type { PartnerInstance } from 'game-domain/schemas/partner'
import { pilotFixture } from '../../../components/__tests__/fixtures'
import { makeSingleUnitStore } from '../../../components/__tests__/mockEntityStore'
import { PartnerMini } from '../PartnerMini'

const companion = {
  id: 'p-rex',
  hostRef: 'mecha-companion',
  hostSchema: 'equipment',
  name: 'Rex',
  systems: ['high-gain-antenna'],
  modules: [],
  conditions: [],
} as PartnerInstance

function renderMini(readOnly = false) {
  const pilot = pilotFixture({
    id: 'pilot-1',
    equipment: ['mecha-companion'],
    partners: [companion],
  })
  const store = makeSingleUnitStore('pilot', pilot, { update: mock(async () => pilot) })
  render(
    <PartnerMini
      found={{ partner: companion, hostKind: 'pilot', host: pilot }}
      store={store}
      readOnly={readOnly}
    />
  )
}

describe('PartnerMini', () => {
  test('the sheet shows the Mini under its own name, the loadout behind Details', () => {
    renderMini()
    expect(screen.getAllByText(/Rex/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/High Gain Antenna/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /rex details/i }))
    expect(screen.getAllByText(/High Gain Antenna/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /manage systems/i })).toBeTruthy()
  })

  test('Read still opens Details, without edit controls', () => {
    renderMini(true)
    fireEvent.click(screen.getByRole('button', { name: /rex details/i }))
    expect(screen.getAllByText(/High Gain Antenna/i).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /manage systems/i })).toBeNull()
  })
})
