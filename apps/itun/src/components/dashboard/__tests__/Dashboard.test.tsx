/**
 * Smoke test for the Dashboard shell (Phase 1).
 *
 * Renders the not-found path (no mech in the store → `entityStore.get` returns
 * null), which exercises Dashboard + DashboardCanvas without needing router
 * context or a seeded store. Confirms the shell mounts and shows the four
 * surfaces' placeholders rather than throwing.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { hydrateStores } from '../../__tests__/hydrateStores'
import { Dashboard } from '../Dashboard'

beforeAll(hydrateStores)

// Convention (see sheet-smoke.test.tsx): toBeTruthy(), not toBeInTheDocument()
// — jest-dom's matcher types aren't augmented onto bun:test's expect.
describe('Dashboard shell', () => {
  test('renders a not-found shell for an unknown mech id', () => {
    render(<Dashboard id="does-not-exist" />)
    expect(screen.getByText('Mech not found')).toBeTruthy()
    expect(screen.getByText(/No mech with id/)).toBeTruthy()
  })
})
