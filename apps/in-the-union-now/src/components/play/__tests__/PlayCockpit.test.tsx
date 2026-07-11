/**
 * Smoke test for the Play Cockpit shell (Phase 1).
 *
 * Renders the not-found path (no mech in the store → `entityStore.get` returns
 * null), which exercises PlayCockpit + CockpitCanvas without needing router
 * context or a seeded store. Confirms the shell mounts and shows the four
 * surfaces' placeholders rather than throwing.
 */

import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'

import { PlayCockpit } from '../PlayCockpit'

// Convention (see sheet-smoke.test.tsx): toBeTruthy(), not toBeInTheDocument()
// — jest-dom's matcher types aren't augmented onto bun:test's expect.
describe('PlayCockpit shell', () => {
  test('renders a not-found shell for an unknown mech id', () => {
    render(<PlayCockpit id="does-not-exist" />)
    expect(screen.getByText('Mech not found')).toBeTruthy()
    expect(screen.getByText(/No mech with id/)).toBeTruthy()
  })
})
