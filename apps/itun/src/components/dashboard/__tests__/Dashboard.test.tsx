/**
 * Smoke test for the Dashboard shell, keyed on the pilot (ADR-038 §1).
 *
 * Renders the two placeholder paths: no pilot in the store, and a pilot with
 * no assigned mech. Both exercise Dashboard + DashboardCanvas without router
 * context and confirm the shell mounts rather than throwing. Who may open the
 * Dashboard at all is `DashboardGate`'s, tested in `DashboardGate.test.tsx`.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { setEntityBackendAuthState } from '../../../stores/entityBackend'
import { useEntityStore } from '../../../stores/entityStore'
import { pilotFixture } from '../../__tests__/fixtures'
import { hydrateStores } from '../../__tests__/hydrateStores'
import { Dashboard } from '../Dashboard'

beforeAll(hydrateStores)

afterAll(async () => {
  await useEntityStore.getState().forget('pilot', 'dash-lone-pilot')
})

// Convention (see sheet-smoke.test.tsx): toBeTruthy(), not toBeInTheDocument()
// — jest-dom's matcher types aren't augmented onto bun:test's expect.
describe('Dashboard shell', () => {
  test('renders a not-found shell for an unknown pilot id', () => {
    render(<Dashboard pilotId="does-not-exist" />)
    expect(screen.getByText('Pilot not found')).toBeTruthy()
    expect(screen.getByText(/No pilot with id/)).toBeTruthy()
  })

  test('a pilot with no assigned mech is told to assign one', async () => {
    setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
    await useEntityStore
      .getState()
      .adopt('pilot', pilotFixture({ id: 'dash-lone-pilot', name: 'Rook' }))
    render(<Dashboard pilotId="dash-lone-pilot" />)
    expect(screen.getByText('Pilot · Rook')).toBeTruthy()
    expect(screen.getByText(/Rook has no assigned mech/)).toBeTruthy()
  })
})
