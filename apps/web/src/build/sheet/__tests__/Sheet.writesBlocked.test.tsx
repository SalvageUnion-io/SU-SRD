/**
 * The Live Sheet's connectivity read-only path (ADR-030 §1).
 *
 * Disconnected, the sheet renders no edit affordance: each one would throw
 * `WritesBlockedOffline` into an unhandled rejection when tapped. These tests
 * pin both halves — the affordances go, and the `settling` window is excluded so a signed-in load
 * does not flash read-only on its way to Connected.
 *
 * Uses toBeTruthy() not toBeInTheDocument() (Wave 4 workaround).
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { Pilot } from 'game-domain/schemas/pilot'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { hydrateStores } from '../../../components/__tests__/hydrateStores'
import {
  makeEntityLookupMock,
  makeSoftLinkStoreMock,
} from '../../../components/__tests__/mockEntityStore'
import type { SyncState } from '../../../replica/syncContext'
import { SyncContext } from '../../../replica/syncContext'
import { Sheet } from '../Sheet'

beforeAll(hydrateStores)

const fakePilot: Pilot = {
  id: 'pilot-1',
  schemaVersion: 1,
  name: 'Yara Voss',
  callsign: 'Ghost',
  classRef: 'scavenger',
  abilities: ['scavenge'],
  equipment: ['pistol'],
  motto: 'Waste not.',
  keepsake: 'A bent coin.',
  appearance: 'Tall, weathered.',
  background: '',
  conditions: [],
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
}

function renderSheetIn(state: SyncState) {
  return render(
    <SyncContext.Provider value={state}>
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityLookupMock([fakePilot])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    </SyncContext.Provider>
  )
}

const CONNECTED: SyncState = {
  status: 'live',
  canWrite: true,
  outdated: false,
}

const DISCONNECTED: SyncState = {
  status: 'offline',
  canWrite: false,
  outdated: false,
}

const SOLO: SyncState = {
  status: 'signedOut',
  canWrite: false,
  outdated: false,
}

const CONNECTING: SyncState = {
  status: 'syncing',
  canWrite: false,
  outdated: false,
}

describe('Sheet — writes blocked by connectivity', () => {
  test('Connected renders Share, and no refusal lozenge', () => {
    renderSheetIn(CONNECTED)
    expect(screen.getByLabelText(/Share this pilot/i)).toBeTruthy()
    expect(screen.queryByText(/^Read Only$/i)).toBeNull()
  })

  test('Disconnected replaces Share with a stated refusal', () => {
    // The gap is the point: withdrawing the control silently reads as a broken
    // app, so the lozenge takes its place rather than leaving a hole.
    renderSheetIn(DISCONNECTED)
    expect(screen.queryByLabelText(/Share this pilot/i)).toBeNull()
    expect(screen.getByText(/^Read Only$/i)).toBeTruthy()
  })

  test('signed out, the refusal asks for a sign-in rather than blaming the connection', () => {
    renderSheetIn(SOLO)
    expect(screen.queryByLabelText(/Share this pilot/i)).toBeNull()
    expect(screen.getByText(/Read-only — sign in to edit/i)).toBeTruthy()
    expect(screen.queryByText(/not connected/i)).toBeNull()
  })

  test('the settling handshake does NOT flash read-only', () => {
    // `canWrite` is false here too, and folding it into `readOnly` would make
    // every signed-in load blink its edit affordances out and back. The write is
    // still refused at the store; it is just refused with a toast, not by
    // pre-emptively dismantling the sheet.
    renderSheetIn(CONNECTING)
    expect(screen.getByLabelText(/Share this pilot/i)).toBeTruthy()
    expect(screen.queryByText(/^Read Only$/i)).toBeNull()
  })
})
