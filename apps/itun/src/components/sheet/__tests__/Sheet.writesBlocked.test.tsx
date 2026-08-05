/**
 * The Live Sheet's connectivity read-only path (ADR-030 §1).
 *
 * `canWrite` used to have no consumers at all: the sheet rendered every edit
 * affordance in Disconnected, and each one threw `WritesBlockedOffline` into an
 * unhandled rejection when tapped. These tests pin the two halves of the fix —
 * the affordances go, and the `settling` window is excluded so a signed-in load
 * does not flash read-only on its way to Connected.
 *
 * Uses toBeTruthy() not toBeInTheDocument() (Wave 4 workaround).
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import type { ConnectionState } from '../../../lib/connection/connectionContext'
import { ConnectionContext } from '../../../lib/connection/connectionContext'
import type { Pilot } from '../../../lib/schemas/pilot'
import { FIXTURE_NOW } from '../../__tests__/fixtures'
import { makeEntityLookupMock, makeSoftLinkStoreMock } from '../../__tests__/mockEntityStore'
import { Sheet } from '../Sheet'

afterEach(() => {
  cleanup()
})

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

function renderSheetIn(state: ConnectionState) {
  return render(
    <ConnectionContext.Provider value={state}>
      <Sheet
        kind="pilot"
        id="pilot-1"
        entityStore={makeEntityLookupMock([fakePilot])}
        softLinkStore={makeSoftLinkStoreMock([])}
      />
    </ConnectionContext.Provider>
  )
}

const CONNECTED: ConnectionState = {
  mode: 'connected',
  canWrite: true,
  showDisconnectedWarning: false,
  settling: false,
}

const DISCONNECTED: ConnectionState = {
  mode: 'disconnected',
  canWrite: false,
  showDisconnectedWarning: true,
  settling: false,
}

const CONNECTING: ConnectionState = {
  mode: 'connecting',
  canWrite: false,
  showDisconnectedWarning: false,
  settling: true,
}

describe('Sheet — writes blocked by connectivity', () => {
  test('Connected renders Share, and no refusal lozenge', () => {
    renderSheetIn(CONNECTED)
    expect(screen.getByLabelText(/Share this pilot as a snapshot/i)).toBeTruthy()
    expect(screen.queryByText(/Read-only — not connected/i)).toBeNull()
  })

  test('Disconnected replaces Share with a stated refusal', () => {
    // The gap is the point: withdrawing the control silently reads as a broken
    // app, so the lozenge takes its place rather than leaving a hole.
    renderSheetIn(DISCONNECTED)
    expect(screen.queryByLabelText(/Share this pilot as a snapshot/i)).toBeNull()
    expect(screen.getByText(/Read-only — not connected/i)).toBeTruthy()
  })

  test('the settling handshake does NOT flash read-only', () => {
    // `canWrite` is false here too, and folding it into `readOnly` would make
    // every signed-in load blink its edit affordances out and back. The write is
    // still refused at the store; it is just refused with a toast, not by
    // pre-emptively dismantling the sheet.
    renderSheetIn(CONNECTING)
    expect(screen.getByLabelText(/Share this pilot as a snapshot/i)).toBeTruthy()
    expect(screen.queryByText(/Read-only — not connected/i)).toBeNull()
  })
})
