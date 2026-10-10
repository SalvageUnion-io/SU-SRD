/**
 * Smoke test for the Dashboard shell, keyed on the pilot (ADR-038 §1).
 *
 * Renders the placeholder for a pilot not in the store, and a pilot with no
 * assigned mech, who plays on foot and boards one from the Board menu
 * (ADR-038 §3). Both exercise Dashboard + DashboardCanvas without router context and
 * confirm the shell mounts rather than throwing. Who may open the
 * Dashboard at all is `DashboardGate`'s, tested in `DashboardGate.test.tsx`.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'
import { pilotFixture } from '../../__tests__/fixtures'

// Module scope, before the imports below — see `convexMock.ts`. The pilot is
// in no Game, so every Game query skips and none needs an answer.
const convexMocks = await installConvexMocks()
setQueryAnswers({})

const { setEntityBackendAuthState } = await import('../../../stores/entityBackend')
const { useEntityStore } = await import('../../../stores/entityStore')
const { hydrateStores } = await import('../../__tests__/hydrateStores')
const { Dashboard } = await import('../Dashboard')

beforeAll(hydrateStores)

afterAll(async () => {
  await useEntityStore.getState().forget('pilot', 'dash-lone-pilot')
  convexMocks.restore()
})

// Convention (see sheet-smoke.test.tsx): toBeTruthy(), not toBeInTheDocument()
// — jest-dom's matcher types aren't augmented onto bun:test's expect.
describe('Dashboard shell', () => {
  test('renders a not-found shell for an unknown pilot id', () => {
    render(<Dashboard pilotId="does-not-exist" />)
    expect(screen.getByText('Pilot not found')).toBeTruthy()
    expect(screen.getByText(/No pilot with id/)).toBeTruthy()
  })

  test('a pilot with no assigned mech plays on foot, offered "Board a mech ▾"', async () => {
    setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
    await useEntityStore
      .getState()
      .adopt('pilot', pilotFixture({ id: 'dash-lone-pilot', name: 'Rook' }))
    render(<Dashboard pilotId="dash-lone-pilot" />)
    expect(screen.getByText('On foot')).toBeTruthy()
    expect(screen.getByText('On Foot')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Board a mech ▾' })).toBeTruthy()
  })
})
