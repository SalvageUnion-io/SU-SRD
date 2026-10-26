import { afterAll, afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'

/**
 * The Game page's member surfaces in their **connected** state:
 * the player's answer queue, read off the Game room's `proposals` record
 * (`fakeRooms.ts` serves it).
 *
 * The server hooks `SyncProvider` uses are mocked through
 * `installServerMocks()`, which owns the capture-and-restore that keeps a
 * process-global `mock.module` from leaking into every test file that runs
 * after this one.
 */

import { installServerMocks } from '../../../components/__tests__/serverMock'
import { closeRooms, serve } from '../../../replica/__tests__/fakeRooms'

// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs. See `serverMock.ts` for the capture/restore rules.
const serverMocks = await installServerMocks()

const { ProposalInbox } = await import('../ProposalInbox')
const { SyncProvider } = await import('../../../replica/SyncProvider')

const wrap = (ui: React.ReactNode) => render(<SyncProvider>{ui}</SyncProvider>)

afterEach(() => {
  cleanup()
  closeRooms()
})

describe('ProposalInbox', () => {
  test('renders nothing when there is nothing to answer', () => {
    serve('g1', { proposals: [] })
    const { container } = wrap(<ProposalInbox gameId="g1" />)
    // An empty inbox should not occupy space on a play surface.
    expect(container.innerHTML).toBe('')
  })

  test('shows what is asked and why, with Apply and Decline', () => {
    serve('g1', {
      proposals: [
        {
          _id: 'c1',
          entityId: 'm1',
          entityType: 'mech',
          targetName: 'Spectrum',
          field: 'currentSP',
          after: 6,
          reason: 'Rifle Squad volley',
          ts: 1,
        },
      ],
    })
    wrap(<ProposalInbox gameId="g1" />)

    expect(screen.getByText('Spectrum · SP → 6')).toBeTruthy()
    expect(screen.getByText('“Rifle Squad volley”')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Apply Spectrum · SP → 6' })).toBeTruthy()
    // Decline is a peer, not a dismissal.
    expect(screen.getByRole('button', { name: 'Decline Spectrum · SP → 6' })).toBeTruthy()
  })

  test('a null value renders as a dash rather than "null"', () => {
    serve('g1', {
      proposals: [
        {
          _id: 'c1',
          entityId: 'm1',
          entityType: 'mech',
          targetName: null,
          field: 'currentSP',
          after: null,
          reason: null,
          ts: 1,
        },
      ],
    })
    wrap(<ProposalInbox gameId="g1" />)
    expect(screen.getByText('mech · SP → —')).toBeTruthy()
  })
})

afterAll(serverMocks.restore)
