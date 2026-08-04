import { afterAll, afterEach, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

/**
 * `InvitePanel` — mint, read back, revoke.
 *
 * The panel exists because the previous screen could only mint: it showed a
 * code once and forgot it, so a leaked code could not be found again, let alone
 * killed. So what is worth testing is what an Organizer can *see and do about*
 * a code that already exists — its state, who spent it, and whether the Revoke
 * button is offered when it would actually do something.
 *
 * Queries are answered **by name** (`getFunctionName`) — see `convexMock.ts`.
 * The panel asks `invites.list` and `invites.pendingRequests`, which sit on
 * adjacent lines (InvitePanel.tsx:48-49): under the old positional queue,
 * swapping those two lines was invisible to this file.
 */

import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'

const calls: { name: string; args: unknown }[] = []

// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs. See `convexMock.ts` for the capture/restore rules.
const convexMocks = await installConvexMocks({
  convexReact: {
    // Every mutation records its call so the tests can assert what the panel
    // asked the server to do, which is the half a render assertion cannot cover.
    useMutation: () => async (args: unknown) => {
      calls.push({ name: 'mutation', args })
      return undefined
    },
  },
})

const { InvitePanel } = await import('../InvitePanel')

const DAY = 1000 * 60 * 60 * 24

function invite(over: Record<string, unknown> = {}) {
  return {
    _id: 'i1',
    code: 'A1B2C3D4',
    label: null,
    role: 'player',
    grantCount: 0,
    requiresApproval: false,
    expiresAt: Date.now() + 14 * DAY,
    usesRemaining: null,
    status: 'active',
    redeemers: [],
    ...over,
  }
}

function renderPanel(invites: unknown[], requests: unknown[] = []) {
  setQueryAnswers({ 'invites:list': invites, 'invites:pendingRequests': requests })
  calls.length = 0
  return render(<InvitePanel gameId={'g1' as never} />)
}

afterEach(cleanup)

describe('reading a code back', () => {
  test('shows the code, its life left, and who spent it', () => {
    renderPanel([invite({ label: 'for Sam', usesRemaining: 2, redeemers: ['Sam'] })])

    expect(screen.getByText('A1B2C3D4')).toBeTruthy()
    expect(screen.getByText(/for Sam/)).toBeTruthy()
    expect(screen.getByText(/2 uses left/)).toBeTruthy()
    expect(screen.getByText(/14 days left/)).toBeTruthy()
    // The whole point of the redemption trail: a name, not a number.
    expect(screen.getByText(/used by Sam/)).toBeTruthy()
  })

  test('an unlimited, never-expiring code says so rather than showing blanks', () => {
    renderPanel([invite({ usesRemaining: null, expiresAt: null })])
    expect(screen.getByText(/unlimited uses/)).toBeTruthy()
    expect(screen.getByText(/no expiry/)).toBeTruthy()
  })

  test('a mediator invite and a gated invite are both legible at a glance', () => {
    renderPanel([invite({ role: 'mediator', requiresApproval: true, grantCount: 2 })])
    expect(screen.getByText(/Mediator seat/)).toBeTruthy()
    expect(screen.getByText(/needs approval/)).toBeTruthy()
    expect(screen.getByText(/2 handed over/)).toBeTruthy()
  })

  test('no codes yet says so', () => {
    renderPanel([])
    expect(screen.getByText(/No invite codes yet/i)).toBeTruthy()
  })
})

describe('revoking', () => {
  test('is offered for a live code and calls through', () => {
    renderPanel([invite()])
    const button = screen.getByText('Revoke')
    fireEvent.click(button)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.args).toMatchObject({ inviteId: 'i1' })
  })

  test('is not offered for a code that is already dead', () => {
    // Revoking an expired or spent code does nothing, so offering the button
    // would be a control that silently no-ops.
    for (const status of ['revoked', 'expired', 'exhausted']) {
      renderPanel([invite({ status })])
      expect(screen.queryByText('Revoke')).toBeNull()
      expect(screen.getByText(status)).toBeTruthy()
      cleanup()
    }
  })

  test('says plainly that revoking does not remove anyone', () => {
    renderPanel([invite()])
    expect(screen.getByText(/never removes anyone who has already joined/i)).toBeTruthy()
  })
})

describe('minting', () => {
  test('passes the note, seat and door through', () => {
    renderPanel([])

    fireEvent.change(screen.getByLabelText('Invite note'), { target: { value: '  for Sam  ' } })
    fireEvent.change(screen.getByLabelText('Invite seat'), { target: { value: 'mediator' } })
    fireEvent.click(screen.getByLabelText('Require approval'))
    fireEvent.click(screen.getByText('Create invite code'))

    expect(calls[0]?.args).toMatchObject({
      gameId: 'g1',
      label: 'for Sam',
      role: 'mediator',
      requiresApproval: true,
    })
  })

  test('an empty note is omitted rather than sent as a blank string', () => {
    renderPanel([])
    fireEvent.click(screen.getByText('Create invite code'))

    const args = calls[0]?.args as { label?: string } | undefined
    expect(args).toBeDefined()
    expect(args?.label).toBeUndefined()
  })

  test('the warning changes with the door being opened', () => {
    renderPanel([])
    expect(screen.getByText(/share it like a key/i)).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Require approval'))
    expect(screen.getByText(/asks to join, and waits for you/i)).toBeTruthy()
  })
})

describe('answering knocks', () => {
  test('lists who is asking, and approving calls through', () => {
    renderPanel(
      [invite({ requiresApproval: true })],
      [
        {
          _id: 'r1',
          displayName: 'Knocker',
          requestedAt: Date.now(),
          inviteLabel: 'from Discord',
          role: 'player',
        },
      ]
    )

    expect(screen.getByText(/Knocker/)).toBeTruthy()
    fireEvent.click(screen.getByText('Approve'))
    expect(calls[0]?.args).toMatchObject({ requestId: 'r1', approve: true })
  })

  test('declining is a separate, explicit act', () => {
    renderPanel(
      [invite({ requiresApproval: true })],
      [
        {
          _id: 'r1',
          displayName: 'Knocker',
          requestedAt: Date.now(),
          inviteLabel: null,
          role: 'player',
        },
      ]
    )
    fireEvent.click(screen.getByText('Decline'))
    expect(calls[0]?.args).toMatchObject({ requestId: 'r1', approve: false })
  })

  test('a knock for the Mediator seat is flagged, because it is a bigger yes', () => {
    renderPanel(
      [invite({ requiresApproval: true, role: 'mediator' })],
      [
        {
          _id: 'r1',
          displayName: 'Knocker',
          requestedAt: Date.now(),
          inviteLabel: null,
          role: 'mediator',
        },
      ]
    )
    expect(screen.getByText('Mediator seat')).toBeTruthy()
  })

  test('no knocks means no section at all', () => {
    renderPanel([invite()], [])
    expect(screen.queryByText(/Asking to join/i)).toBeNull()
  })
})

afterAll(convexMocks.restore)
