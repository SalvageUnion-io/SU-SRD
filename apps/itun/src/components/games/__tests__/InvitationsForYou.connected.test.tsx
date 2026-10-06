import { afterAll, describe, expect, test } from 'bun:test'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'

/**
 * The hub's Invitations card (ADR-039) — invites addressed to your Discord
 * account, found here whatever happened to the DM.
 *
 * Worth defending: it is invisible until there is something to answer, it
 * shows what a link holder would see and no more, and its two buttons call the
 * two different mutations — joining moves the hub to that Game, declining
 * moves nothing.
 */

import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'

const calls: { name: string; args: unknown }[] = []

const convexMocks = await installConvexMocks({
  convexReact: {
    useMutation: (ref: unknown) => async (args: unknown) => {
      const name = getFunctionName(ref as FunctionReference<'mutation'>)
      calls.push({ name, args })
      return name === 'invites:redeem' ? { kind: 'joined', gameId: 'g7', granted: 0 } : null
    },
  },
})

const { InvitationsForYou } = await import('../InvitationsForYou')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')
const { getActiveContainer, setActiveContainer } = await import(
  '../../../stores/activeContainerStore'
)

const DAY = 1000 * 60 * 60 * 24

function invitation(over: Record<string, unknown> = {}) {
  return {
    _id: 'i1',
    code: 'A1B2C3D4',
    gameName: 'Tenacity',
    invitedBy: 'Vex',
    role: 'player',
    grantCount: 0,
    expiresAt: Date.now() + 6 * DAY + 1000,
    ...over,
  }
}

function renderCard(invitations: unknown) {
  setActiveContainer({ kind: 'shelf' })
  setQueryAnswers({ 'invites:forMe': invitations })
  calls.length = 0
  return render(
    <ConnectionProvider>
      <InvitationsForYou />
    </ConnectionProvider>
  )
}

afterAll(() => convexMocks.restore())

describe('Invitations on the hub', () => {
  test('is not there at all when nothing is addressed to you', () => {
    const { container } = renderCard([])
    expect(container.textContent).toBe('')
  })

  test('is not there while loading either', () => {
    const { container } = renderCard(undefined)
    expect(container.textContent).toBe('')
  })

  test('says who invited you to what, the seat, what is waiting, and how long is left', () => {
    renderCard([invitation({ role: 'mediator', grantCount: 2 })])
    expect(screen.getByText('Vex invited you to Tenacity')).toBeTruthy()
    expect(screen.getByText('Mediator seat')).toBeTruthy()
    expect(screen.getByText(/2 characters are waiting for you · 7 days left/)).toBeTruthy()
  })

  test('joining redeems that code and shows the Game', async () => {
    renderCard([invitation()])
    fireEvent.click(screen.getByText('Join'))
    await waitFor(() => expect(getActiveContainer()).toEqual({ kind: 'game', gameId: 'g7' }))
    expect(calls).toEqual([{ name: 'invites:redeem', args: { code: 'A1B2C3D4' } }])
  })

  test('declining declines that code and moves nothing', async () => {
    renderCard([invitation()])
    fireEvent.click(screen.getByText('Decline'))
    await waitFor(() =>
      expect(calls).toEqual([{ name: 'invites:decline', args: { code: 'A1B2C3D4' } }])
    )
    expect(getActiveContainer()).toEqual({ kind: 'shelf' })
  })
})
