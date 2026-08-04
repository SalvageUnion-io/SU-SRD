import { afterAll, afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

/**
 * `/join/$code` — the link half of an invite.
 *
 * This is the one URL in the app a stranger can be handed, so the failure modes
 * worth defending are about people who are not signed in and codes that are no
 * longer any good:
 *
 *  - a dead code must say which kind of dead, and must NOT prompt a sign-in
 *    (authenticating only to learn the code expired is the worst version of it)
 *  - a signed-out visitor must still see what they were invited to
 *  - a gated invite must say it is asking, not claim it joined
 *
 * Queries are answered **by name** (`getFunctionName`) — see `convexMock.ts`.
 * This screen asks only `invites.preview`, from two components.
 */

import { convexReactMock, setQueryAnswers } from '../../__tests__/convexMock'

let redeemResult: unknown = { kind: 'joined', gameId: 'g1', granted: 0 }
let redeemError: Error | null = null
// Flipped per-test: the signed-out path is the one a stranger following a link
// actually hits, so it needs exercising rather than assuming.
let isAuthenticated = true
const navigations: unknown[] = []

const realConvexClient = { ...(await import('../../../lib/connection/convexClient')) }
const realConvexReact = { ...(await import('convex/react')) }
const realAuthReact = { ...(await import('@convex-dev/auth/react')) }
const realRouter = { ...(await import('@tanstack/react-router')) }

mock.module('../../../lib/connection/convexClient', () => ({
  isConvexConfigured: true,
  convexClient: {},
}))

mock.module('convex/react', () =>
  convexReactMock({
    useMutation: () => async () => {
      if (redeemError !== null) throw redeemError
      return redeemResult
    },
    useConvexAuth: () => ({ isAuthenticated, isLoading: false }),
  })
)

mock.module('@convex-dev/auth/react', () => ({
  useAuthActions: () => ({ signIn: async () => undefined, signOut: async () => undefined }),
  ConvexAuthProvider: ({ children }: { children: unknown }) => children,
}))

mock.module('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => async (opts: unknown) => {
    navigations.push(opts)
  },
  useRouter: () => undefined,
}))

const { JoinScreen } = await import('../JoinScreen')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')

function preview(over: Record<string, unknown> = {}) {
  return {
    gameName: 'Union Crawler #430',
    invitedBy: 'Vex',
    role: 'player',
    requiresApproval: false,
    grantCount: 0,
    status: 'active',
    ...over,
  }
}

function renderJoin(value: unknown) {
  setQueryAnswers({ 'invites:preview': value })
  navigations.length = 0
  redeemError = null
  isAuthenticated = true
  return render(
    <ConnectionProvider>
      <JoinScreen code="A1B2C3D4" />
    </ConnectionProvider>
  )
}

afterEach(cleanup)

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

  test('accepting routes into the game', async () => {
    renderJoin(preview())
    fireEvent.click(screen.getByText('Join this game'))
    await waitFor(() => expect(navigations).toHaveLength(1))
    expect(navigations[0]).toMatchObject({ params: { gameId: 'g1' } })
  })

  test('a refusal is surfaced in the server’s own words', async () => {
    renderJoin(preview())
    redeemError = new Error('That invite code has been revoked')
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
    redeemResult = { kind: 'joined', gameId: 'g1', granted: 0 }
  })
})

describe('a code that is no good', () => {
  test('an unknown code says so and offers no sign-in', () => {
    renderJoin(null)
    expect(screen.getByText(/not valid/i)).toBeTruthy()
    expect(screen.queryByText('Join this game')).toBeNull()
  })

  test('each kind of dead code says which kind it is', () => {
    for (const [status, copy] of [
      ['revoked', /has been revoked/i],
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
        <JoinScreen code="A1B2C3D4" />
      </ConnectionProvider>
    )

    expect(screen.getByText('Union Crawler #430')).toBeTruthy()
    expect(screen.getByText(/Sign in to accept/i)).toBeTruthy()
    // Not offered the button, because pressing it could not work yet.
    expect(screen.queryByText('Join this game')).toBeNull()
  })

  test('a dead code is refused without ever prompting a sign-in', () => {
    isAuthenticated = false
    setQueryAnswers({ 'invites:preview': preview({ status: 'expired' }) })
    render(
      <ConnectionProvider>
        <JoinScreen code="A1B2C3D4" />
      </ConnectionProvider>
    )

    expect(screen.getByText(/has expired/i)).toBeTruthy()
    expect(screen.queryByText(/Sign in to accept/i)).toBeNull()
    isAuthenticated = true
  })
})

afterAll(() => {
  mock.module('../../../lib/connection/convexClient', () => realConvexClient)
  mock.module('convex/react', () => realConvexReact)
  mock.module('@convex-dev/auth/react', () => realAuthReact)
  mock.module('@tanstack/react-router', () => realRouter)
})
