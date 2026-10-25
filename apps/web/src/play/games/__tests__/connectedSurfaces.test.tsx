import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'

/**
 * The Game page's member surfaces in their **connected** state:
 * the player's answer queue.
 *
 * The Convex hooks are mocked through `installConvexMocks()`, which owns the
 * capture-and-restore that keeps a process-global `mock.module` from leaking
 * into every test file that runs after this one.
 */

import { getFunctionName } from 'convex/server'
/**
 * Queries are answered **by name** (`getFunctionName`) — see `convexMock.ts`.
 */
import { installConvexMocks, setQueryAnswers } from '../../../components/__tests__/convexMock'

const mutations: { name: string; args: unknown }[] = []
let mutationError: Error | null = null

// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs. See `convexMock.ts` for the capture/restore rules.
const convexMocks = await installConvexMocks({
  convexReact: {
    useMutation: (ref: unknown) => async (args: unknown) => {
      mutations.push({ name: getFunctionName(ref as never), args })
      if (mutationError !== null) throw mutationError
    },
  },
})

const { ProposalInbox } = await import('../ProposalInbox')
const { SyncProvider } = await import('../../../replica/SyncProvider')

const wrap = (ui: React.ReactNode) => render(<SyncProvider>{ui}</SyncProvider>)

beforeEach(() => {
  mutations.length = 0
  mutationError = null
})

describe('ProposalInbox', () => {
  test('renders nothing when there is nothing to answer', () => {
    setQueryAnswers({ 'ops:pending': [] })
    const { container } = wrap(<ProposalInbox gameId={'g1' as never} />)
    // An empty inbox should not occupy space on a play surface.
    expect(container.innerHTML).toBe('')
  })

  test('shows what is asked and why, with Apply and Decline', () => {
    setQueryAnswers({
      'ops:pending': [
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
    wrap(<ProposalInbox gameId={'g1' as never} />)

    expect(screen.getByText('Spectrum · SP → 6')).toBeTruthy()
    expect(screen.getByText('“Rifle Squad volley”')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Apply Spectrum · SP → 6' })).toBeTruthy()
    // Decline is a peer, not a dismissal.
    expect(screen.getByRole('button', { name: 'Decline Spectrum · SP → 6' })).toBeTruthy()
  })

  test('a null value renders as a dash rather than "null"', () => {
    setQueryAnswers({
      'ops:pending': [
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
    wrap(<ProposalInbox gameId={'g1' as never} />)
    expect(screen.getByText('mech · SP → —')).toBeTruthy()
  })
})

afterAll(convexMocks.restore)
