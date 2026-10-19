import { afterAll, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

/**
 * `/invite/$token` — a Game's invite URL, in Play (ADR-052 §4).
 *
 * This is the one URL in the app a stranger can be handed, so the failure modes
 * worth defending are about people who are not signed in and links that are no
 * longer any good:
 *
 *  - a dead link must say so, explain how invite links work, and must NOT
 *    prompt a sign-in (authenticating only to learn the link was reset is the
 *    worst version of it)
 *  - a signed-out visitor must still see what they were invited to
 *  - back from "Sign in to join", the page joins without asking again
 *
 * Queries are answered **by name** (`getFunctionName`) — see `convexMock.ts`.
 * This screen asks only `invites.preview`, from two components.
 */

import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'
import { ConvexError } from 'convex/values'
import { installConvexMocks, setQueryAnswers } from '../../../components/__tests__/convexMock'

const redeemResult: unknown = { kind: 'joined', gameId: 'g1' }
let redeemError: Error | null = null
// Which mutations the screen called, by name.
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
      return redeemResult
    },
    useConvexAuth: () => ({ isAuthenticated, isLoading: false }),
  },
})

const navigations = convexMocks.navigations

const { InviteScreen } = await import('../InviteScreen')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')

function preview(over: Record<string, unknown> = {}) {
  return {
    gameName: 'Union Crawler #430',
    invitedBy: 'Vex',
    ...over,
  }
}

/** What joining opens: the Game's own page, in Play. */
const THE_GAME = { to: '/play/games/$gameId', params: { gameId: 'g1' } }

function renderJoin(value: unknown, joinOnArrival = false) {
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
    expect(screen.getByText('Join this Game')).toBeTruthy()
  })

  test('warns that a table reads each other’s sheets', () => {
    renderJoin(preview())
    expect(screen.getByText(/read each other/i)).toBeTruthy()
  })

  test('accepting opens the Game’s page in Play', async () => {
    renderJoin(preview())
    fireEvent.click(screen.getByText('Join this Game'))
    await waitFor(() => expect(navigations).toEqual([THE_GAME]))
  })

  test('back from "Sign in to join", it joins without asking again', async () => {
    renderJoin(preview(), true)
    await waitFor(() => expect(navigations).toEqual([THE_GAME]))
    expect(mutationCalls).toEqual(['invites:redeem'])
  })

  test('arriving to join a dead link spends nothing', () => {
    renderJoin(null, true)
    expect(mutationCalls).toHaveLength(0)
    expect(navigations).toEqual([])
  })

  test('a refusal is surfaced in the server’s own words', async () => {
    renderJoin(preview())
    redeemError = new ConvexError('That invite link no longer works')
    fireEvent.click(screen.getByText('Join this Game'))
    await waitFor(() => expect(screen.getByText(/no longer works/)).toBeTruthy())
  })
})

describe('a link that is no good', () => {
  test('an unknown link says so, explains invite links and offers no sign-in', () => {
    renderJoin(null)
    expect(screen.getByText(/does not work/i)).toBeTruthy()
    expect(screen.getByText(/may have been reset/i)).toBeTruthy()
    // An old typed code from `/join/…` lands here too: say how joining works now.
    expect(screen.getByText(/there is no code to type/i)).toBeTruthy()
    expect(screen.queryByText('Join this Game')).toBeNull()
    expect(screen.getByRole('link', { name: 'Back to Play' }).getAttribute('href')).toBe('/play/')
  })

  test('still checking is not the same as invalid', () => {
    renderJoin(undefined)
    expect(screen.getByText(/Checking that invite/i)).toBeTruthy()
    expect(screen.queryByText(/does not work/i)).toBeNull()
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
    expect(screen.queryByText('Join this Game')).toBeNull()
  })

  test('a dead code is refused without ever prompting a sign-in', () => {
    isAuthenticated = false
    setQueryAnswers({ 'invites:preview': null })
    render(
      <ConnectionProvider>
        <InviteScreen token="A1B2C3D4E5F6G7H8" />
      </ConnectionProvider>
    )

    expect(screen.getByText(/does not work/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Sign in to join' })).toBeNull()
    // Its ways on: back to your shelves, and — signed out — a plain sign-in.
    expect(screen.getByRole('link', { name: 'Back to Play' }).getAttribute('href')).toBe('/play/')
    expect(screen.getByRole('button', { name: 'Sign in with Discord' })).toBeTruthy()
    isAuthenticated = true
  })
})

afterAll(() => {
  convexMocks.restore()
})
