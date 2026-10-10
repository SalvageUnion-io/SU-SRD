import { afterAll, describe, expect, test } from 'bun:test'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'

/**
 * The Invited banner above the shelves (ADR-039; Shelves, board S1) — invites
 * addressed to your Discord account, found here whatever happened to the DM.
 *
 * Worth defending: it is invisible until there is something to answer, it
 * shows what a link holder would see and no more, joining redeems the code and
 * opens that Game, and "Not now" answers nothing — it only puts the banner away.
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

  test('says who invited you to what, in which seat, what to bring, and how long is left', () => {
    renderCard([invitation()])
    expect(screen.getByText('Invited')).toBeTruthy()
    const banner = screen.getByRole('listitem')
    expect(banner.textContent).toContain('Vex invited you to Tenacity as a player.')
    expect(banner.textContent).toContain(
      'Bring a pilot from your shelf, or make one when you get there.'
    )
    expect(banner.textContent).toContain('7 days left')
  })

  test('a Mediator seat, with characters waiting', () => {
    renderCard([invitation({ role: 'mediator', grantCount: 2 })])
    const banner = screen.getByRole('listitem')
    expect(banner.textContent).toContain('Vex invited you to Tenacity as its Mediator.')
    expect(banner.textContent).toContain('2 characters are waiting for you there.')
  })

  test('joining redeems that code and shows the Game', async () => {
    renderCard([invitation()])
    fireEvent.click(screen.getByRole('button', { name: 'Join the Game' }))
    await waitFor(() => expect(getActiveContainer()).toEqual({ kind: 'game', gameId: 'g7' }))
    expect(calls).toEqual([{ name: 'invites:redeem', args: { code: 'A1B2C3D4' } }])
  })

  test('"Not now" puts it away and answers nothing', () => {
    const { container } = renderCard([invitation()])
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(container.textContent).toBe('')
    expect(calls).toEqual([])
    expect(getActiveContainer()).toEqual({ kind: 'shelf' })
  })
})
