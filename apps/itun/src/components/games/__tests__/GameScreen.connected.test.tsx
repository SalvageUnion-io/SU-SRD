import { afterAll, afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'

/**
 * `GameScreen` — one Game, connected.
 *
 * Two things are worth defending here. Invite management belongs to the
 * Organizer, and showing it to anyone else would be offering a control the
 * server will refuse. And `games.get` returning `null` means "not a member",
 * which must read as an explanation rather than a crash — a bookmarked URL for
 * a Game you left is an ordinary thing to visit.
 *
 * Queries are answered in **call order** — the generated `api` is a Proxy that
 * throws when inspected, so position is the only stable key.
 */

let queryQueue: unknown[] = []
let queryIndex = 0

const realConvexClient = { ...(await import('../../../lib/connection/convexClient')) }
const realConvexReact = { ...(await import('convex/react')) }
const realRouter = { ...(await import('@tanstack/react-router')) }

mock.module('../../../lib/connection/convexClient', () => ({
  isConvexConfigured: true,
  convexClient: {},
}))

mock.module('convex/react', () => ({
  useQuery: () => {
    const value = queryQueue[queryIndex]
    queryIndex += 1
    return value
  },
  useMutation: () => async () => undefined,
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  ConvexReactClient: class {},
  ConvexProvider: ({ children }: { children: unknown }) => children,
  ConvexProviderWithAuth: ({ children }: { children: unknown }) => children,
  useConvex: () => ({}),
  useAction: () => async () => undefined,
}))

mock.module('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => async () => undefined,
  useRouter: () => undefined,
}))

const { GameScreen } = await import('../GameScreen')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')

function withQueries(values: unknown[]): void {
  queryQueue = values
  queryIndex = 0
}

const wrap = () =>
  render(
    <ConnectionProvider>
      <GameScreen gameId="g1" />
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

/**
 * Everything downstream of `games.get`, in render order: GameRoster's
 * account.me / games.members / entities.listForGame, then the invite panel's
 * two queries, then the proposal inbox and Downtime panel. Only the first slot
 * (games.get) varies between these tests.
 */
const REST = [
  { _id: 'u1', displayName: 'Ash' },
  [],
  { pilots: [], mechs: [], crawlers: [], softLinks: [] },
  [],
  [],
  [],
  { running: false, stepIndex: null, completedBy: [], upkeepSpent: false },
  false,
]

afterEach(cleanup)

describe('GameScreen', () => {
  test('a plain member gets no invite management', () => {
    withQueries([GAME, ...REST])
    wrap()

    // The server refuses a non-Organizer's invites.list outright, so offering
    // the panel here would be a control that only ever errors.
    expect(screen.queryByText('Create invite code')).toBeNull()
    expect(screen.queryByLabelText('Invite note')).toBeNull()
  })

  test('every panel states its name in its header band', () => {
    // A pending proposal, so the inbox renders at all (it returns null when
    // there is nothing to answer).
    // Slot 5 is `proposals.pending` — see the REST comment for the order.
    const withProposal: unknown[] = [...REST]
    withProposal[5] = [{ _id: 'p1', entityType: 'pilot', field: 'currentHP', to: 3 }]
    withQueries([{ ...GAME, organizer: true }, ...withProposal])
    wrap()

    // These titles used to sit inside each panel's body as a small grey stamp.
    // They are the Card's header now, and `Invite someone` in particular
    // changed OWNER in that move — it is rendered by GameScreen, not by
    // InvitePanel — so nothing else would catch it going missing.
    expect(screen.getByText('Invite someone')).toBeTruthy()
    expect(screen.getByText('Awaiting your answer')).toBeTruthy()
    expect(screen.getByText('Downtime')).toBeTruthy()
  })

  test('an Organizer gets invite management', () => {
    withQueries([{ ...GAME, organizer: true }, ...REST])
    wrap()

    expect(screen.getByText('Create invite code')).toBeTruthy()
    expect(screen.getByLabelText('Invite note')).toBeTruthy()
    expect(screen.getByLabelText('Invite seat')).toBeTruthy()
    expect(screen.getByLabelText('Require approval')).toBeTruthy()
  })

  test('a game you are not in explains itself instead of crashing', () => {
    withQueries([null, ...REST])
    wrap()

    expect(screen.getByText(/not in this game/i)).toBeTruthy()
    expect(screen.queryByText('Create invite code')).toBeNull()
  })

  test('still loading is not the same as not a member', () => {
    withQueries([undefined, ...REST])
    wrap()

    expect(screen.getByText(/Loading this game/i)).toBeTruthy()
    expect(screen.queryByText(/not in this game/i)).toBeNull()
  })
})

afterAll(() => {
  mock.module('../../../lib/connection/convexClient', () => realConvexClient)
  mock.module('convex/react', () => realConvexReact)
  mock.module('@tanstack/react-router', () => realRouter)
})
