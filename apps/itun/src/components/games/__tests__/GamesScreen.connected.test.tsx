import { afterAll, describe, expect, mock, test } from 'bun:test'
import { render, screen } from '@testing-library/react'

/**
 * `GamesScreen` in its connected state.
 *
 * The Solo test proves it does not crash without a provider. This covers what
 * the screen actually does for a signed-in player: which controls a plain
 * member gets versus an Organizer, and whether the Mediator link appears only
 * for somebody who mediates.
 *
 * Queries are answered in **call order** — the generated `api` object is a
 * Proxy that throws the moment a test inspects it, so position is the only
 * stable key. The order is the render order of the hooks.
 */

let queryQueue: unknown[] = []
let queryIndex = 0

/**
 * `mock.module` replaces the entry in the process-wide module registry, so these
 * mocks outlive this file and would otherwise poison every test that runs after
 * it — the exports below are captured first and put back in `afterAll`.
 *
 * The spread is load-bearing. A module namespace is a *live* view, and mocking
 * rewrites it in place, so holding the namespace itself captures nothing: by
 * `afterAll` it already reads as the mock.
 */
const realConvexClient = { ...(await import('../../../lib/connection/convexClient')) }
const realConvexReact = { ...(await import('convex/react')) }
const realAuthReact = { ...(await import('@convex-dev/auth/react')) }
const realRouter = { ...(await import('@tanstack/react-router')) }

mock.module('../../../lib/connection/convexClient', () => ({
  isConvexConfigured: true,
  convexClient: {},
}))

mock.module('convex/react', () => ({
  useQuery: () => {
    const v = queryQueue[queryIndex]
    queryIndex += 1
    return v
  },
  useMutation: () => async () => undefined,
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  ConvexReactClient: class {},
  // `@convex-dev/auth/react` (reached via SignInControl) imports these from
  // convex/react, so a partial mock of the module breaks its import rather
  // than the component under test.
  ConvexProviderWithAuth: ({ children }: { children: unknown }) => children,
  ConvexProvider: ({ children }: { children: unknown }) => children,
  useConvex: () => ({}),
  useAction: () => async () => undefined,
}))

mock.module('@convex-dev/auth/react', () => ({
  useAuthActions: () => ({ signIn: async () => undefined, signOut: async () => undefined }),
  ConvexAuthProvider: ({ children }: { children: unknown }) => children,
}))

// The Mediator link is a router `Link`, which needs a RouterProvider it has no
// business needing here — the assertion is whether the link is offered at all.
mock.module('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

const { GamesScreen } = await import('../GamesScreen')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')

function withQueries(values: unknown[]): void {
  queryQueue = values
  queryIndex = 0
}

const wrap = () =>
  render(
    <ConnectionProvider>
      <GamesScreen />
    </ConnectionProvider>
  )

const GAME = {
  _id: 'g1',
  name: 'Union Crawler #430',
  templateOrigin: undefined,
  mediator: false,
  organizer: false,
  memberCount: 3,
}

const MEMBERS = [
  {
    userId: 'u1',
    displayName: 'Ash',
    avatarUrl: undefined,
    mediator: false,
    organizer: true,
    joinedAt: 1,
  },
  {
    userId: 'u2',
    displayName: 'Beefcake',
    avatarUrl: undefined,
    mediator: true,
    organizer: false,
    joinedAt: 2,
  },
]

const TEMPLATES = [
  { id: 'starter-set', name: 'Reclamation of the Wastes', description: 'Six pre-gens.' },
]

/** listMine, templates, members, pending, downtime state, amMediator. */
function queriesFor(game: Record<string, unknown>): unknown[] {
  return [
    [game],
    TEMPLATES,
    MEMBERS,
    [],
    { running: false, stepIndex: null, completedBy: [], upkeepSpent: false },
    false,
  ]
}

describe('GamesScreen for a signed-in player', () => {
  test('lists the games you are in, with the crew', () => {
    withQueries(queriesFor(GAME))
    wrap()

    expect(screen.getByText('Union Crawler #430')).toBeTruthy()
    expect(screen.getByText('Ash')).toBeTruthy()
    expect(screen.getByText('Beefcake')).toBeTruthy()
  })

  test('offers create and join to everybody', () => {
    withQueries(queriesFor(GAME))
    wrap()

    expect(screen.getByLabelText('New game name')).toBeTruthy()
    expect(screen.getByLabelText('Invite code')).toBeTruthy()
  })

  test('a plain member gets no administrative controls', () => {
    withQueries(queriesFor(GAME))
    wrap()

    // Renaming, inviting and role changes are the Organizer's, and hiding them
    // is the courtesy half of a rule the server enforces regardless.
    expect(screen.queryByLabelText('Rename Union Crawler #430')).toBeNull()
    expect(screen.queryByText('Create invite code')).toBeNull()
    expect(screen.queryByText('Make Mediator')).toBeNull()
  })

  test('an Organizer gets rename, invites and role controls', () => {
    withQueries(queriesFor({ ...GAME, organizer: true }))
    wrap()

    expect(screen.getByLabelText('Rename Union Crawler #430')).toBeTruthy()
    expect(screen.getByText('Create invite code')).toBeTruthy()
    expect(screen.getAllByText(/Make Mediator|Stand down/).length).toBeGreaterThan(0)
  })

  test('the Mediator link appears only for somebody who mediates', () => {
    withQueries(queriesFor(GAME))
    wrap()
    expect(screen.queryByText(/Open the Mediator surface/)).toBeNull()

    withQueries(queriesFor({ ...GAME, mediator: true }))
    wrap()
    expect(screen.getAllByText(/Open the Mediator surface/).length).toBeGreaterThan(0)
  })

  test('offers a template to start from', () => {
    withQueries(queriesFor(GAME))
    wrap()
    expect(screen.getByText('Reclamation of the Wastes')).toBeTruthy()
    expect(screen.getByText('Start this game')).toBeTruthy()
  })

  test('no games yet says so, and still offers the way in', () => {
    withQueries([[], TEMPLATES])
    wrap()

    expect(screen.getByText(/not in any games yet/i)).toBeTruthy()
    expect(screen.getByLabelText('Invite code')).toBeTruthy()
  })
})

afterAll(() => {
  mock.module('../../../lib/connection/convexClient', () => realConvexClient)
  mock.module('convex/react', () => realConvexReact)
  mock.module('@convex-dev/auth/react', () => realAuthReact)
  mock.module('@tanstack/react-router', () => realRouter)
})
