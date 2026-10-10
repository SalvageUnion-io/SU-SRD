import { afterAll, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

/**
 * `/invite/$token` — an invite link (issue 1255).
 *
 * This is the one URL in the app a stranger can be handed, so the failure modes
 * worth defending are about people who are not signed in and links that are no
 * longer any good:
 *
 *  - a dead link must say which kind of dead, explain how invite links work, and
 *    must NOT prompt a sign-in (authenticating only to learn the link expired is
 *    the worst version of it)
 *  - a signed-out visitor must still see what they were invited to
 *  - a gated invite must say it is asking, not claim it joined
 *  - back from "Sign in to join", the page joins without asking again
 *
 * Queries are answered **by name** (`getFunctionName`) — see `convexMock.ts`.
 * This screen asks only `invites.preview`, from two components.
 */

import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'
import { ConvexError } from 'convex/values'
import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'

let redeemResult: unknown = { kind: 'joined', gameId: 'g1', granted: 0 }
let redeemError: Error | null = null
// The preview a decline test started from, re-served as declined once it lands.
let declinedPreview: Record<string, unknown> = {}
// Which mutations the screen called, by name — redeem and decline share the
// stub, so the name is what tells "joined" from "declined" apart.
const mutationCalls: string[] = []
// Flipped per-test: the signed-out path is the one a stranger following a link
// actually hits, so it needs exercising rather than assuming.
let isAuthenticated = true
// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs. See `convexMock.ts` for the capture/restore rules.
//
// `authReact` for the signed-out branch's sign-in control; `router` because
// redeeming navigates, and the stub records where.
const convexMocks = await installConvexMocks({
  authReact: true,
  router: true,
  convexReact: {
    useMutation: (ref: unknown) => async () => {
      const name = getFunctionName(ref as FunctionReference<'mutation'>)
      mutationCalls.push(name)
      if (redeemError !== null) throw redeemError
      if (name === 'invites:decline') {
        // What the live subscription does: the declined invite now previews
        // as declined, which is exactly what the screen must not mistake for
        // somebody else's dead code.
        setQueryAnswers({ 'invites:preview': preview({ ...declinedPreview, status: 'declined' }) })
        return null
      }
      return redeemResult
    },
    useConvexAuth: () => ({ isAuthenticated, isLoading: false }),
  },
})

const navigations = convexMocks.navigations

const { InviteScreen } = await import('../InviteScreen')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')
const { getActiveContainer, setActiveContainer } = await import(
  '../../../stores/activeContainerStore'
)

function preview(over: Record<string, unknown> = {}) {
  return {
    gameName: 'Union Crawler #430',
    invitedBy: 'Vex',
    role: 'player',
    requiresApproval: false,
    grantCount: 0,
    status: 'active',
    expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
    addressed: null,
    forYou: null,
    ...over,
  }
}

/** What joining shows: the Game (its own page, with a router — `useShowContainer`). */
const THE_GAME = { kind: 'game' as const, gameId: 'g1' }

function renderJoin(value: unknown, joinOnArrival = false) {
  setActiveContainer({ kind: 'shelf' })
  setQueryAnswers({ 'invites:preview': value })
  navigations.length = 0
  mutationCalls.length = 0
  redeemError = null
  isAuthenticated = true
  return render(
    <ConnectionProvider>
      <InviteScreen token="A1B2C3D4E5F6G7H8" joinOnArrival={joinOnArrival} />
    </ConnectionProvider>
  )
}

describe('a live invite', () => {
  test('names the game and who invited you before asking for anything', () => {
    renderJoin(preview())
    expect(screen.getByText(/Vex/)).toBeTruthy()
    expect(screen.getByText('Union Crawler #430')).toBeTruthy()
    expect(screen.getByText('Join this game')).toBeTruthy()
  })

  test('a Mediator invite says which chair is on offer', () => {
    renderJoin(preview({ role: 'mediator' }))
    expect(screen.getByText(/as its Mediator/)).toBeTruthy()
  })

  test('a waiting character is mentioned, singular and plural', () => {
    renderJoin(preview({ grantCount: 1 }))
    expect(screen.getByText(/A character is waiting for you/)).toBeTruthy()
    cleanup()

    renderJoin(preview({ grantCount: 3 }))
    expect(screen.getByText(/3 characters are waiting for you/)).toBeTruthy()
  })

  test('warns that a table reads each other’s sheets', () => {
    renderJoin(preview())
    expect(screen.getByText(/read each other/i)).toBeTruthy()
  })

  test('accepting shows the Game', async () => {
    renderJoin(preview())
    fireEvent.click(screen.getByText('Join this game'))
    await waitFor(() => expect(getActiveContainer()).toEqual(THE_GAME))
  })

  test('back from "Sign in to join", it joins without asking again', async () => {
    renderJoin(preview(), true)
    await waitFor(() => expect(getActiveContainer()).toEqual(THE_GAME))
    expect(mutationCalls).toEqual(['invites:redeem'])
  })

  test('arriving to join a dead link spends nothing', () => {
    renderJoin(preview({ status: 'revoked' }), true)
    expect(mutationCalls).toHaveLength(0)
    expect(getActiveContainer()).toEqual({ kind: 'shelf' })
  })

  test('a refusal is surfaced in the server’s own words', async () => {
    renderJoin(preview())
    redeemError = new ConvexError('That invite link has been revoked')
    fireEvent.click(screen.getByText('Join this game'))
    await waitFor(() => expect(screen.getByText(/has been revoked/)).toBeTruthy())
  })
})

describe('a gated invite', () => {
  test('offers to ask rather than to join', () => {
    renderJoin(preview({ requiresApproval: true }))
    expect(screen.getByText('Ask to join')).toBeTruthy()
    expect(screen.getByText(/asks the organizer to let you in/i)).toBeTruthy()
  })

  test('after knocking it says it is waiting, and does not pretend to have joined', async () => {
    renderJoin(preview({ requiresApproval: true }))
    redeemResult = { kind: 'pending', gameId: 'g1' }
    fireEvent.click(screen.getByText('Ask to join'))
    await waitFor(() => expect(screen.getByText(/Asked to join/)).toBeTruthy())

    expect(navigations).toHaveLength(0)
    expect(getActiveContainer()).toEqual({ kind: 'shelf' })
    // The way out is Shelves; the game appears in Games once approved.
    expect(screen.getByRole('link', { name: 'Back to your shelves' }).getAttribute('href')).toBe(
      '/'
    )
    redeemResult = { kind: 'joined', gameId: 'g1', granted: 0 }
  })
})

describe('an invite addressed to you (ADR-039)', () => {
  test('can be declined, and a bearer code cannot', () => {
    renderJoin(preview({ addressed: 'discord', forYou: true }))
    expect(screen.getByText('Decline')).toBeTruthy()
    cleanup()

    // A bearer code may be meant for the whole table; one person's "no" must
    // not close it for the rest.
    renderJoin(preview())
    expect(screen.queryByText('Decline')).toBeNull()
  })

  test('declining says so and goes nowhere', async () => {
    declinedPreview = { addressed: 'discord', forYou: true }
    renderJoin(preview(declinedPreview))
    fireEvent.click(screen.getByText('Decline'))
    await waitFor(() => expect(screen.getByText(/You declined the invite/)).toBeTruthy())

    expect(mutationCalls).toEqual(['invites:decline'])
    expect(navigations).toHaveLength(0)
    expect(getActiveContainer()).toEqual({ kind: 'shelf' })
  })

  test('opened by a different Discord account, it says so before any button is pressed', () => {
    renderJoin(preview({ addressed: 'discord', forYou: false }))
    expect(screen.getByText(/sent to a different Discord account/)).toBeTruthy()
    expect(screen.queryByText('Join this game')).toBeNull()
    expect(screen.queryByText('Decline')).toBeNull()
  })
})

describe('a link that is no good', () => {
  test('an unknown link says so, explains invite links and offers no sign-in', () => {
    renderJoin(null)
    expect(screen.getByText(/not valid/i)).toBeTruthy()
    // An old typed code from `/join/…` lands here too: say how joining works now.
    expect(screen.getByText(/there is no code to type/i)).toBeTruthy()
    expect(screen.queryByText('Join this game')).toBeNull()
    expect(screen.getByRole('link', { name: 'Back to your shelves' }).getAttribute('href')).toBe(
      '/'
    )
  })

  test('each kind of dead code says which kind it is', () => {
    for (const [status, copy] of [
      ['revoked', /has been revoked/i],
      ['declined', /was declined/i],
      ['expired', /has expired/i],
      ['exhausted', /already been used/i],
    ] as const) {
      renderJoin(preview({ status }))
      expect(screen.getByText(copy)).toBeTruthy()
      // Never a join button for a code that cannot be spent.
      expect(screen.queryByText('Join this game')).toBeNull()
      cleanup()
    }
  })

  test('still checking is not the same as invalid', () => {
    renderJoin(undefined)
    expect(screen.getByText(/Checking that invite/i)).toBeTruthy()
    expect(screen.queryByText(/not valid/i)).toBeNull()
  })
})

describe('a visitor who is not signed in', () => {
  test('still sees what they were invited to, then a way in', () => {
    // The whole point of a link is that it means something before you have an
    // account. Demanding a sign-in first would tell a stranger nothing.
    renderJoin(preview())
    isAuthenticated = false
    cleanup()
    setQueryAnswers({ 'invites:preview': preview() })
    render(
      <ConnectionProvider>
        <InviteScreen token="A1B2C3D4E5F6G7H8" />
      </ConnectionProvider>
    )

    expect(screen.getByText('Union Crawler #430')).toBeTruthy()
    expect(screen.getByText(/Sign in to join\. Your pilots/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign in to join' })).toBeTruthy()
    // Not offered the button, because pressing it could not work yet.
    expect(screen.queryByText('Join this game')).toBeNull()
  })

  test('a Discord-addressed invite asks for that account in particular', () => {
    isAuthenticated = false
    setQueryAnswers({ 'invites:preview': preview({ addressed: 'discord' }) })
    render(
      <ConnectionProvider>
        <InviteScreen token="A1B2C3D4E5F6G7H8" />
      </ConnectionProvider>
    )

    expect(screen.getByText(/sent to one Discord account/i)).toBeTruthy()
  })

  test('a dead code is refused without ever prompting a sign-in', () => {
    isAuthenticated = false
    setQueryAnswers({ 'invites:preview': preview({ status: 'expired' }) })
    render(
      <ConnectionProvider>
        <InviteScreen token="A1B2C3D4E5F6G7H8" />
      </ConnectionProvider>
    )

    expect(screen.getByText(/has expired/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Sign in to join' })).toBeNull()
    isAuthenticated = true
  })
})

afterAll(() => {
  setActiveContainer({ kind: 'shelf' })
  convexMocks.restore()
})
