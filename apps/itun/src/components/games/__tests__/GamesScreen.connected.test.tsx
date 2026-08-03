import { afterAll, afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

/**
 * `GamesScreen` in its connected state — the Games *index*.
 *
 * Since the route split this screen is only about choosing a Game: create,
 * join, and one row per table. Everything per-Game (crew, invites, roles, the
 * Mediator link) moved to `/games/$gameId`, and is covered by
 * `GameDetailScreen.connected.test.tsx`.
 *
 * Queries are answered in **call order** — the generated `api` object is a
 * Proxy that throws the moment a test inspects it, so position is the only
 * stable key. The order is the render order of the hooks.
 */

let queryQueue: unknown[] = []
let queryIndex = 0
let redeemResult: unknown = { kind: 'joined', gameId: 'g9', granted: 0 }
let redeemError: Error | null = null
const navigations: unknown[] = []

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
  useMutation: () => async () => {
    if (redeemError !== null) throw redeemError
    return redeemResult
  },
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

// Rows link through the router, and joining navigates — neither needs a real
// RouterProvider for these assertions.
mock.module('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => async (opts: unknown) => {
    navigations.push(opts)
  },
  useRouter: () => undefined,
}))

const { GamesScreen } = await import('../GamesScreen')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')

function withQueries(values: unknown[]): void {
  queryQueue = values
  queryIndex = 0
  navigations.length = 0
  redeemError = null
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
  crawlerName: 'Hamlet',
  pilotCount: 4,
  mechCount: 3,
}

const TEMPLATES = [
  { id: 'starter-set', name: 'Reclamation of the Wastes', description: 'Six pre-gens.' },
]

/** listMine, templates — the index's only two queries. */
function queriesFor(game: Record<string, unknown>): unknown[] {
  return [[game], TEMPLATES]
}

afterEach(cleanup)

describe('the Games index for a signed-in player', () => {
  test('lists a row per game', () => {
    withQueries(queriesFor(GAME))
    wrap()
    expect(screen.getByText('Union Crawler #430')).toBeTruthy()
  })

  test('the row badges say what the table is', () => {
    withQueries(queriesFor(GAME))
    wrap()

    // A Game row answers "what is this table" before you open it.
    expect(screen.getByText('Hamlet')).toBeTruthy()
    expect(screen.getByText('4 Pilots')).toBeTruthy()
    expect(screen.getByText('3 Mechs')).toBeTruthy()
  })

  test('a game with nothing in it still renders all three badges', () => {
    withQueries(queriesFor({ ...GAME, crawlerName: null, pilotCount: 0, mechCount: 0 }))
    wrap()

    // Dropping the badges would make a new Game's row look broken rather than empty.
    expect(screen.getByText('No crawler')).toBeTruthy()
    expect(screen.getByText('0 Pilots')).toBeTruthy()
    expect(screen.getByText('0 Mechs')).toBeTruthy()
  })

  test('the row links to the game, not to a modal', () => {
    withQueries(queriesFor(GAME))
    wrap()
    expect(screen.getByText('View').getAttribute('href')).toBe('/games/g1')
  })

  test('offers create and join to everybody', () => {
    withQueries(queriesFor(GAME))
    wrap()

    expect(screen.getByLabelText('New game name')).toBeTruthy()
    expect(screen.getByLabelText('Invite code')).toBeTruthy()
  })

  test('per-game administration is NOT on the index, for anyone', () => {
    withQueries(queriesFor({ ...GAME, organizer: true, mediator: true }))
    wrap()

    // These moved to /games/$gameId. An Organizer seeing them here would mean
    // the split half-happened.
    expect(screen.queryByLabelText('Rename Union Crawler #430')).toBeNull()
    expect(screen.queryByText('Create invite code')).toBeNull()
    expect(screen.queryByText('Make Mediator')).toBeNull()
    expect(screen.queryByText(/Open the Mediator surface/)).toBeNull()
  })

  test('offers a template to start from, behind a control rather than inline', () => {
    withQueries(queriesFor(GAME))
    wrap()

    // A template is a list to READ — a name plus a paragraph each — so it sits
    // in a dialog and the controls band stays a band. Inline, it wedged a
    // screenful of prose between the controls and the games list.
    expect(screen.queryByText('Reclamation of the Wastes')).toBeNull()

    fireEvent.click(screen.getByText('From a template'))

    expect(screen.getByText('Reclamation of the Wastes')).toBeTruthy()
    expect(screen.getByText('Start this game')).toBeTruthy()
  })

  test('the creating controls come BEFORE the games they act on', () => {
    withQueries(queriesFor(GAME))
    const { container } = wrap()

    // The point of the band (this is the Roster's rhythm): what you can DO is
    // one ink-ruled row across the top, and what you HAVE lists beneath it.
    // This screen used to stack three creation Cards, so the games you came to
    // open sat below a screenful of forms you had already used.
    const text = container.textContent ?? ''
    const controls = text.indexOf('Start a game')
    const joinControl = text.indexOf('Join with a code')
    const list = text.indexOf('Union Crawler #430')

    for (const index of [controls, joinControl, list]) expect(index).toBeGreaterThan(-1)
    expect(controls).toBeLessThan(list)
    expect(joinControl).toBeLessThan(list)
  })

  test('no games yet says so, and still offers the way in', () => {
    withQueries([[], TEMPLATES])
    wrap()

    expect(screen.getByText(/not in any games yet/i)).toBeTruthy()
    expect(screen.getByLabelText('Invite code')).toBeTruthy()
  })
})

describe('joining by code from the lobby', () => {
  test('a successful join routes into the game it joined', async () => {
    withQueries(queriesFor(GAME))
    wrap()

    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'A1B2C3D4' } })
    fireEvent.click(screen.getByText('Join'))

    await waitFor(() => expect(navigations).toHaveLength(1))
    expect(navigations[0]).toMatchObject({ params: { gameId: 'g9' } })
  })

  test('a gated code says it is waiting instead of routing nowhere', async () => {
    withQueries(queriesFor(GAME))
    redeemResult = { kind: 'pending', gameId: 'g9' }
    wrap()

    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'A1B2C3D4' } })
    fireEvent.click(screen.getByText('Join'))

    await waitFor(() => expect(screen.getByText(/once the organizer approves/i)).toBeTruthy())
    // Routing into a Game you cannot yet see would be the wrong reassurance.
    expect(navigations).toHaveLength(0)
    redeemResult = { kind: 'joined', gameId: 'g9', granted: 0 }
  })

  test('a refusal is shown in the server’s own words', async () => {
    withQueries(queriesFor(GAME))
    wrap()
    redeemError = new Error('That invite code has expired')

    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'A1B2C3D4' } })
    fireEvent.click(screen.getByText('Join'))

    await waitFor(() => expect(screen.getByText(/has expired/)).toBeTruthy())
  })

  test('Join is disabled until a code is typed', () => {
    withQueries(queriesFor(GAME))
    wrap()
    expect((screen.getByText('Join') as HTMLButtonElement).disabled).toBe(true)
  })
})

afterAll(() => {
  mock.module('../../../lib/connection/convexClient', () => realConvexClient)
  mock.module('convex/react', () => realConvexReact)
  mock.module('@convex-dev/auth/react', () => realAuthReact)
  mock.module('@tanstack/react-router', () => realRouter)
})
