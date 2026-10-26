/**
 * Tests for the lib/entities layer.
 *
 * Covers the contract the migrated components rely on:
 *   - list hooks read the store's in-memory state
 *   - reading an unhydrated type auto-triggers lazy hydration (like
 *     entityStore.list())
 *
 * Conventions: real in-memory stores, no mock.module(),
 * toBeTruthy()/toBeFalsy() (no jest-dom augmentation).
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { resetStores } from '../../../replica/__tests__/resetStores'
import { withSignedInBackend } from '../../../replica/__tests__/signedInBackend'
import { useUnits } from '../../../replica/units'
import { usePilots } from '../index'

// Building and editing need an account (ADR-034 as amended), so these writes run signed in.
withSignedInBackend()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const basePilotInput = {
  schemaVersion: 1 as const,
  name: 'Zara Heln',
  callsign: 'Flash',
  classRef: 'scavenger',
  abilities: [],
  equipment: [],
  motto: 'Keep moving.',
  keepsake: 'Old photo.',
  appearance: 'Short.',
  background: '',
  conditions: [],
}

beforeEach(resetStores)

afterEach(() => {
  // Unmount before the reset: this hook runs before the preload's cleanup, and a
  // mounted subscriber answers the reset by starting hydrations that resolve after act().
  cleanup()
  resetStores()
})

// ---------------------------------------------------------------------------
// Entity hooks
// ---------------------------------------------------------------------------

describe('usePilots', () => {
  test('returns pilots from in-memory state', async () => {
    await useUnits.getState().hydrate('pilot')
    await useUnits.getState().create('pilot', basePilotInput)

    function PilotList() {
      const pilots = usePilots()
      return (
        <ul>
          {pilots.map((p) => (
            <li key={p.id}>{p.name}</li>
          ))}
        </ul>
      )
    }

    await act(async () => {
      render(<PilotList />)
    })

    expect(screen.getByText('Zara Heln')).toBeTruthy()
  })

  test('auto-triggers lazy hydration for an unhydrated type', async () => {
    // A row the server sent, held while pilots are still unhydrated.
    await useUnits.getState().adopt('pilot', {
      ...basePilotInput,
      id: crypto.randomUUID(),
      createdAt: FIXTURE_NOW,
      updatedAt: FIXTURE_NOW,
    })
    expect(useUnits.getState().hydrated.pilots).toBe(false)

    function PilotList() {
      const pilots = usePilots()
      return <p>{pilots[0]?.name ?? 'empty'}</p>
    }

    await act(async () => {
      render(<PilotList />)
    })

    // The hook fired hydrate(); once it resolves the subscriber re-renders.
    await waitFor(() => {
      expect(screen.getByText('Zara Heln')).toBeTruthy()
    })
    expect(useUnits.getState().hydrated.pilots).toBe(true)
  })
})
