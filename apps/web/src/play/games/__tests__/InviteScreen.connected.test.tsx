import { afterAll, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

/**
 * `/games/invite/$token` — a Game's invite URL, in Play (ADR-052 §4).
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
 * Its one read is the invite preview, a Worker route (`answerRoutes`).
 */

import { installServerMocks } from '../../../components/__tests__/serverMock'
import {
  accountAnswers,
  accountApiStub,
  accountWrites,
} from '../../../lib/account/__tests__/accountApiStub'
import { answerRoutes, withWorkerRoutes } from '../../../lib/sharing/__tests__/workerRoutes'
import { sharedPaths } from '../../../lib/sharing/paths'
import { RoomDeclined } from '../../../replica/roomSocket'

const redeemResult: unknown = { kind: 'joined', gameId: 'g1' }
let redeemError: Error | null = null
// Which mutations the screen called, by name.
const mutationCalls: string[] = []
// Flipped per-test: the signed-out path is the one a stranger following a link
// actually hits, so it needs exercising rather than assuming.
let isAuthenticated = true
// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs. See `serverMock.ts` for the capture/restore rules.
//
// `authReact` for the signed-out branch's sign-in control; `router` because
// redeeming navigates, and the stub records where.
const serverMocks = await installServerMocks({
  authReact: { useSession: () => ({ isAuthenticated, isLoading: false }) },
  router: true,
  call: (name) => {
    mutationCalls.push(name)
    if (redeemError !== null) throw redeemError
    return redeemResult
  },
  also: { '../../lib/account/accountApi': accountApiStub },
})

const navigations = serverMocks.navigations
withWorkerRoutes()

const TOKEN = 'A1B2C3D4E5F6G7H8'

/** The invite preview's answer; undefined leaves it loading. */
function answerPreview(value: unknown): void {
  answerRoutes(value === undefined ? {} : { [sharedPaths.invite(TOKEN)]: value })
}

const { InviteScreen } = await import('../InviteScreen')
const { SyncProvider } = await import('../../../replica/SyncProvider')

function preview(over: Record<string, unknown> = {}) {
  return {
    gameName: 'Union Crawler #430',
    mediatedBy: 'Vex',
    ...over,
  }
}

/** What joining opens: the Game's own page, in Play. */
const THE_GAME = { to: '/games/$gameId', params: { gameId: 'g1' } }

function renderJoin(value: unknown, joinOnArrival = false, displayName: string | null = 'Sam') {
  accountAnswers.me = { displayName }
  answerPreview(value)
  navigations.length = 0
  mutationCalls.length = 0
  redeemError = null
  isAuthenticated = true
  accountWrites.length = 0
  return render(
    <SyncProvider>
      <InviteScreen token={TOKEN} joinOnArrival={joinOnArrival} />
    </SyncProvider>
  )
}

describe('a live invite', () => {
  test('names the game and who mediates it before asking for anything', () => {
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
    expect(mutationCalls).toEqual(['invites.redeem'])
  })

  // r7 C1 (MD7-01, LG7-01): asked once, here, and filled in.
  test('the Display name is filled in from the account, and a changed one is kept', async () => {
    renderJoin(preview())
    const field = screen.getByLabelText('Display name') as HTMLInputElement
    expect(field.value).toBe('Sam')
    fireEvent.change(field, { target: { value: 'Ana' } })
    fireEvent.click(screen.getByText('Join this Game'))
    await waitFor(() => expect(navigations).toEqual([THE_GAME]))
    expect(accountWrites).toEqual([{ name: 'updateProfile', args: { displayName: 'Ana' } }])
  })

  test('back from signing in with no name yet, it asks before joining', () => {
    renderJoin(preview(), true, null)
    expect(mutationCalls).toHaveLength(0)
    expect((screen.getByLabelText('Display name') as HTMLInputElement).value).toBe('')
  })

  test('arriving to join a dead link spends nothing', () => {
    renderJoin(null, true)
    expect(mutationCalls).toHaveLength(0)
    expect(navigations).toEqual([])
  })

  test('a refusal is surfaced in the server’s own words', async () => {
    renderJoin(preview())
    redeemError = new RoomDeclined('That invite link no longer works')
    fireEvent.click(screen.getByText('Join this Game'))
    await waitFor(() => expect(screen.getByText(/no longer works/)).toBeTruthy())
  })
})

describe('a link that is no good', () => {
  test('an unknown link says so, explains invite links and offers no sign-in', () => {
    renderJoin(null)
    expect(screen.getByText(/has expired/i)).toBeTruthy()
    expect(screen.getByText(/may have been reset/i)).toBeTruthy()
    // An old typed code from `/join/…` lands here too: say how joining works now.
    expect(screen.getByText(/there is no code to type/i)).toBeTruthy()
    expect(screen.queryByText('Join this Game')).toBeNull()
    expect(screen.getByRole('link', { name: 'Back to Games' }).getAttribute('href')).toBe('/games/')
  })

  test('still checking is not the same as invalid', () => {
    renderJoin(undefined)
    expect(screen.getByText(/Checking that invite/i)).toBeTruthy()
    expect(screen.queryByText(/has expired/i)).toBeNull()
  })
})

describe('a visitor who is not signed in', () => {
  test('still sees what they were invited to, then a way in', () => {
    // The whole point of a link is that it means something before you have an
    // account. Demanding a sign-in first would tell a stranger nothing.
    renderJoin(preview())
    isAuthenticated = false
    cleanup()
    answerPreview(preview())
    render(
      <SyncProvider>
        <InviteScreen token={TOKEN} />
      </SyncProvider>
    )

    expect(screen.getByText('Union Crawler #430')).toBeTruthy()
    expect(screen.getByText(/Sign in to join\. Your pilots/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign in to join' })).toBeTruthy()
    // Not offered the button, because pressing it could not work yet.
    expect(screen.queryByText('Join this Game')).toBeNull()
  })

  test('a dead code is refused without ever prompting a sign-in', () => {
    isAuthenticated = false
    answerPreview(null)
    render(
      <SyncProvider>
        <InviteScreen token={TOKEN} />
      </SyncProvider>
    )

    expect(screen.getByText(/has expired/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Sign in to join' })).toBeNull()
    // Its ways on: back to your shelves, and — signed out — a plain sign-in.
    expect(screen.getByRole('link', { name: 'Back to Games' }).getAttribute('href')).toBe('/games/')
    // r8 C7 (LG8-21): Games leads; sign-in, which cannot fix the link, is second and outlined.
    const games = screen.getByRole('link', { name: 'Back to Games' })
    const signIn = screen.getByRole('button', { name: 'Sign in with Discord' })
    expect(games.className).toContain('su-btn--primary')
    expect(signIn.className).not.toContain('su-btn--primary')
    expect(games.compareDocumentPosition(signIn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    isAuthenticated = true
  })
})

afterAll(() => {
  serverMocks.restore()
})
