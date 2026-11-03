/**
 * PartnerCard — a companion's loadout is editable: Edit offers Manage Systems
 * and Manage Modules (the mech sheet's picker, since a companion attaches them
 * by mech rules, Core Book p.68), even before anything is installed; Read
 * offers neither.
 *
 * Conventions: toBeTruthy() not toBeInTheDocument(), dep-injected store.
 */

import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import type { PartnerInstance } from 'game-domain/schemas/partner'
import { pilotFixture } from '../../../components/__tests__/fixtures'
import { makeSingleUnitStore } from '../../../components/__tests__/mockEntityStore'
import { PartnerCard } from '../PartnerCard'

const companion: PartnerInstance = {
  id: 'p-rex',
  hostRef: 'mecha-companion',
  hostSchema: 'equipment',
  name: 'Rex',
  systems: [],
  modules: [],
  conditions: [],
} as PartnerInstance

function renderCard(readOnly = false) {
  const pilot = pilotFixture({
    id: 'pilot-1',
    equipment: ['mecha-companion'],
    partners: [companion],
  })
  const update = mock(async () => pilot)
  const store = makeSingleUnitStore('pilot', pilot, { update })
  render(
    <PartnerCard
      found={{ partner: companion, hostKind: 'pilot', host: pilot }}
      store={store}
      readOnly={readOnly}
    />
  )
}

describe('PartnerCard — loadout editing', () => {
  test('Edit offers Manage Systems and Manage Modules on an empty companion', () => {
    renderCard()
    expect(screen.getByRole('button', { name: /manage systems/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /manage modules/i })).toBeTruthy()
  })

  test('Manage Systems opens the install picker', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /manage systems/i }))
    expect(screen.getAllByText(/add systems/i).length).toBeGreaterThan(0)
  })

  test('Read offers no loadout controls', () => {
    renderCard(true)
    expect(screen.queryByRole('button', { name: /manage systems/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /manage modules/i })).toBeNull()
  })
})
