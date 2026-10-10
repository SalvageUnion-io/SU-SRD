import { afterAll, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'

/**
 * `InvitePanel` and `JoinRequests` — the Organizer's half of a Game's own page
 * (board M2, issue 1278): mint, read back, copy and revoke a link, and answer
 * whoever is asking to join.
 *
 * What is worth testing is what an Organizer can *see and do about* an invite
 * that already exists — its seat, its door, its life left, who spent it, its
 * link, and whether Revoke is offered when it would actually do something —
 * and that a new link's choices reach the server. An invite is a link, never a
 * typed code (issue 1255).
 *
 * Queries are answered **by name** (`getFunctionName`) — see `convexMock.ts`.
 */

import { getFunctionName } from 'convex/server'
import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'

const calls: { name: string; args: unknown }[] = []

// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs. See `convexMock.ts` for the capture/restore rules.
const convexMocks = await installConvexMocks({
  convexReact: {
    // Every mutation records its call so the tests can assert what the panel
    // asked the server to do, which is the half a render assertion cannot cover.
    // `create` answers with the new link's token; the rest answer nothing.
    useMutation: (ref: unknown) => async (args: unknown) => {
      calls.push({ name: getFunctionName(ref as never), args })
      return 'NEWTOKEN0000TKN0'
    },
  },
})

const { InvitePanel } = await import('../InvitePanel')
const { expiresIn, usedLine } = await import('../../../lib/games/inviteExpiry')
const { JoinRequests } = await import('../JoinRequests')

const DAY = 1000 * 60 * 60 * 24

function invite(over: Record<string, unknown> = {}) {
  return {
    _id: 'i1',
    code: 'A1B2C3D4',
    label: null,
    role: 'player',
    grantCount: 0,
    requiresApproval: false,
    expiresAt: Date.now() + 6 * DAY + 60_000,
    usesRemaining: null,
    status: 'active',
    redeemers: [],
    target: null,
    delivery: null,
    ...over,
  }
}

/** Every link the panel put on the clipboard. */
const copied: string[] = []

function renderPanel(invites: unknown[]) {
  setQueryAnswers({ 'invites:list': invites })
  calls.length = 0
  copied.length = 0
  return render(
    <InvitePanel
      gameId={'g1' as never}
      clipboardWriter={async (text) => {
        copied.push(text)
      }}
    />
  )
}

const openLinks = () => within(screen.getByRole('list', { name: 'Open invite links' }))

describe('reading a link back', () => {
  test('its seat as a stamp, its door, its life left, its link and its uses', () => {
    renderPanel([invite({ requiresApproval: true, redeemers: ['Sam', 'Ivo'] })])

    const card = openLinks()
    expect(card.getByText('Player seat')).toBeTruthy()
    expect(card.getByText(/You approve each · expires in 6 days/)).toBeTruthy()
    expect(card.getByText(/\/invite\/A1B2C3D4$/)).toBeTruthy()
    // The redemption trail: a count in words, and the names.
    expect(card.getByText(/Used twice · by Sam, Ivo/)).toBeTruthy()
  })

  test('a bearer Mediator link says so, and that it is not used yet', () => {
    renderPanel([invite({ role: 'mediator', grantCount: 2 })])
    const card = openLinks()
    expect(card.getByText('Mediator seat')).toBeTruthy()
    expect(card.getByText(/Anyone with it joins · 2 handed over/)).toBeTruthy()
    expect(card.getByText('Not used yet')).toBeTruthy()
  })

  test('no open links says so', () => {
    renderPanel([])
    expect(screen.getByText(/No open links/i)).toBeTruthy()
  })

  test('a live link copies its whole URL', async () => {
    renderPanel([invite()])
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy player seat link' }))
    })
    expect(copied).toEqual([`${window.location.origin}/invite/A1B2C3D4`])
  })

  test('expiry and use counts read as words', () => {
    const now = 1_000_000
    expect(expiresIn(now + 23 * 60 * 60 * 1000 + 5, now)).toBe('expires in 23 h')
    expect(expiresIn(now + DAY + 5, now)).toBe('expires in 1 day')
    expect(expiresIn(now - 1, now)).toBe('expired')
    expect(usedLine(1)).toBe('Used once')
    expect(usedLine(3)).toBe('Used 3 times')
  })
})

describe('revoking', () => {
  test('is offered for a live link and calls through', async () => {
    renderPanel([invite()])
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Revoke player seat link' }))
    })
    expect(calls).toEqual([{ name: 'invites:revoke', args: { inviteId: 'i1' } }])
  })

  test('a closed link drops to one line with its state, and offers no revoke', () => {
    renderPanel([
      invite({ _id: 'i2', status: 'expired', redeemers: ['Sam'] }),
      invite({ _id: 'i3', status: 'declined', target: { kind: 'discord', name: 'sam' } }),
    ])
    const closed = within(screen.getByRole('list', { name: 'Closed invite links' }))
    expect(closed.getByText(/Player seat · expired · used by Sam/)).toBeTruthy()
    expect(closed.getByText(/declined · sent to @sam/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Revoke/ })).toBeNull()
  })

  test('says plainly that revoking does not remove anyone', () => {
    renderPanel([invite()])
    expect(screen.getByText(/never removes anyone who has already joined/i)).toBeTruthy()
  })
})

describe('a new link', () => {
  test('defaults to a player seat, seven days, and no approval', async () => {
    renderPanel([])
    expect(
      (screen.getByLabelText('I approve each person who uses it') as HTMLInputElement).checked
    ).toBe(false)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Make link' }))
    })
    expect(calls[0]).toEqual({
      name: 'invites:create',
      args: { gameId: 'g1', role: 'player', requiresApproval: false, expiresInMs: 7 * DAY },
    })
    // A new link is made to be sent, so it lands on the clipboard.
    expect(copied).toEqual([`${window.location.origin}/invite/NEWTOKEN0000TKN0`])
  })

  test('passes the seat, expiry and door through', async () => {
    renderPanel([])
    fireEvent.change(screen.getByLabelText('Seat'), { target: { value: 'mediator' } })
    fireEvent.change(screen.getByLabelText('Expires'), { target: { value: '1' } })
    fireEvent.click(screen.getByLabelText('I approve each person who uses it'))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Make link' }))
    })
    expect(calls[0]?.args).toEqual({
      gameId: 'g1',
      role: 'mediator',
      requiresApproval: true,
      expiresInMs: DAY,
    })
  })

  test('the warning changes with the door being opened', () => {
    renderPanel([])
    expect(screen.getByText(/share it like a key/i)).toBeTruthy()
    fireEvent.click(screen.getByLabelText('I approve each person who uses it'))
    expect(screen.getByText(/asks to join and waits for you/i)).toBeTruthy()
  })
})

describe('asking to join', () => {
  function renderRequests(requests: unknown[]) {
    setQueryAnswers({ 'invites:pendingRequests': requests })
    calls.length = 0
    return render(<JoinRequests gameId={'g1' as never} />)
  }

  const knock = (over: Record<string, unknown> = {}) => ({
    _id: 'r1',
    displayName: 'Nadia',
    requestedAt: Date.now() - 2 * 60_000,
    inviteLabel: null,
    role: 'player',
    ...over,
  })

  test('lists who is asking, by which seat link and when, and Let in calls through', async () => {
    renderRequests([knock()])
    expect(screen.getByText('Nadia')).toBeTruthy()
    expect(screen.getByText('Player seat link · asked 2 min ago')).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Let Nadia in' }))
    })
    expect(calls).toEqual([
      { name: 'invites:decideRequest', args: { requestId: 'r1', approve: true } },
    ])
  })

  test('declining is a separate, explicit act', async () => {
    renderRequests([knock()])
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Decline Nadia' }))
    })
    expect(calls[0]?.args).toEqual({ requestId: 'r1', approve: false })
  })

  test('a knock for the Mediator seat says so, because it is a bigger yes', () => {
    renderRequests([knock({ role: 'mediator' })])
    expect(screen.getByText(/Mediator seat link/)).toBeTruthy()
  })

  test('nobody waiting says so', () => {
    renderRequests([])
    expect(screen.getByText(/Nobody is waiting/)).toBeTruthy()
  })
})

afterAll(convexMocks.restore)
