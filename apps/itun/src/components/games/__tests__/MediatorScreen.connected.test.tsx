import { afterAll, describe, expect, mock, test } from 'bun:test'
import { render, screen } from '@testing-library/react'

/**
 * `MediatorScreen` in its connected state.
 *
 * The Solo test proves the screen refuses gracefully with no account. This
 * covers the surface itself: that it is gated on actually mediating, and that
 * the propose form obeys the one rule that is easy to lose — you may only
 * propose to an entity that has somebody to answer.
 *
 * Queries are answered in **call order**; the generated `api` object is a Proxy
 * that throws when inspected, so position is the only stable key. Render order
 * is: amMediator, crew (vitals), presence, crew (propose form), alerts,
 * downtime state, downtime amMediator, npcs.
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

const { MediatorScreen } = await import('../MediatorScreen')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')

function withQueries(values: unknown[]): void {
  queryQueue = values
  queryIndex = 0
}

const wrap = () =>
  render(
    <ConnectionProvider>
      <MediatorScreen gameId="g1" />
    </ConnectionProvider>
  )

const CLAIMED_PILOT = {
  _id: 'p1',
  appId: null,
  ownerId: 'u2',
  ownerName: 'Beefcake',
  name: 'Roach-Boy',
  currentHp: 8,
  currentAp: 4,
}

const UNCLAIMED_PILOT = {
  _id: 'p2',
  appId: null,
  ownerId: null,
  ownerName: null,
  name: 'Pre-gen',
  currentHp: 10,
  currentAp: 5,
}

const DOWNTIME = { running: false, stepIndex: null, completedBy: [], upkeepSpent: false }

/** The full mediating render, with whatever crew and tray the case needs. */
function mediatingQueries(
  crew: Record<string, unknown>,
  extra: { presence?: unknown; alerts?: unknown; npcs?: unknown } = {}
): unknown[] {
  return [
    true,
    crew,
    extra.presence ?? [],
    crew,
    extra.alerts ?? [],
    DOWNTIME,
    true,
    extra.npcs ?? [],
  ]
}

describe('who the Mediator surface is for', () => {
  test('somebody who does not mediate is told so, and gets none of the tools', () => {
    withQueries([false])
    wrap()

    expect(screen.getByText(/You do not mediate this game/i)).toBeTruthy()
    // The refusal has to be total: a visible propose form that the server would
    // reject is worse than no form.
    expect(screen.queryByLabelText('Proposal target')).toBeNull()
    expect(screen.queryByLabelText('Alert message')).toBeNull()
    expect(screen.queryByLabelText('NPC name')).toBeNull()
  })

  test('while the role is still unknown it says so rather than guessing', () => {
    // Rendering the tools optimistically would flash the whole Mediator surface
    // at a player who is about to be refused it.
    withQueries([undefined])
    wrap()
    expect(screen.getByText('Loading…')).toBeTruthy()
  })

  test('the Mediator gets every panel', () => {
    withQueries(mediatingQueries({ viewerId: 'u1', pilots: [CLAIMED_PILOT], mechs: [] }))
    wrap()

    expect(screen.getByText('Propose a change')).toBeTruthy()
    expect(screen.getByText('Tell the table')).toBeTruthy()
    expect(screen.getByText('Opposition')).toBeTruthy()
  })
})

describe('proposing a change', () => {
  test('only claimed entities are offered as targets', () => {
    withQueries(
      mediatingQueries({
        viewerId: 'u1',
        pilots: [CLAIMED_PILOT, UNCLAIMED_PILOT],
        mechs: [],
      })
    )
    wrap()

    // An unclaimed pre-gen has nobody to answer the proposal, so offering it
    // would build a dead end into the form.
    expect(screen.getByRole('option', { name: 'Roach-Boy (pilot)' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Pre-gen (pilot)' })).toBeNull()
  })

  test('mechs are offered alongside pilots, labelled by kind', () => {
    withQueries(
      mediatingQueries({
        viewerId: 'u1',
        pilots: [],
        mechs: [{ ...CLAIMED_PILOT, _id: 'm1', name: 'Iron Mongrel' }],
      })
    )
    wrap()
    expect(screen.getByRole('option', { name: 'Iron Mongrel (mech)' })).toBeTruthy()
  })

  test('it says out loud that it is asking, not setting', () => {
    // The propose/confirm rule is the whole point of the surface; if the
    // wording ever drifts to sounding authoritative, this should fail.
    withQueries(mediatingQueries({ viewerId: 'u1', pilots: [], mechs: [] }))
    wrap()
    expect(screen.getByText(/You are asking, not setting/i)).toBeTruthy()
  })

  test('Propose stays disabled until there is a target and a value', () => {
    withQueries(mediatingQueries({ viewerId: 'u1', pilots: [CLAIMED_PILOT], mechs: [] }))
    wrap()

    const button = screen.getByText('Propose').closest('button')
    expect(button?.disabled).toBe(true)
  })
})

describe('the rest of the table', () => {
  test('presence reads as here or away, per person', () => {
    withQueries(
      mediatingQueries(
        { viewerId: 'u1', pilots: [], mechs: [] },
        {
          presence: [
            { userId: 'u2', displayName: 'Beefcake', present: true },
            { userId: 'u3', displayName: 'Ash', present: false },
          ],
        }
      )
    )
    wrap()

    expect(screen.getByText('At the table')).toBeTruthy()
    expect(screen.getByText('here')).toBeTruthy()
    expect(screen.getByText('away')).toBeTruthy()
  })

  test('nobody at the table renders no panel at all', () => {
    withQueries(mediatingQueries({ viewerId: 'u1', pilots: [], mechs: [] }, { presence: [] }))
    wrap()
    // An empty roster of who is present is noise, not information.
    expect(screen.queryByText('At the table')).toBeNull()
  })

  test('recent alerts are shown back, and Send needs a message', () => {
    withQueries(
      mediatingQueries(
        { viewerId: 'u1', pilots: [], mechs: [] },
        { alerts: [{ _id: 'a1', message: 'The crawler is taking fire.' }] }
      )
    )
    wrap()

    expect(screen.getByText('The crawler is taking fire.')).toBeTruthy()
    expect(screen.getByText('Send').closest('button')?.disabled).toBe(true)
  })

  test('the tray is named as private, and an unnamed NPC still reads as something', () => {
    withQueries(
      mediatingQueries(
        { viewerId: 'u1', pilots: [], mechs: [] },
        {
          npcs: [
            { _id: 'n1', body: {} },
            { _id: 'n2', body: { name: 'Scrap Hound' } },
          ],
        }
      )
    )
    wrap()

    expect(screen.getByText(/Only you can see this/i)).toBeTruthy()
    // A blank row would look like a rendering bug in the middle of a session.
    expect(screen.getByText('Unnamed')).toBeTruthy()
    expect(screen.getByText('Scrap Hound')).toBeTruthy()
  })
})

afterAll(() => {
  mock.module('../../../lib/connection/convexClient', () => realConvexClient)
  mock.module('convex/react', () => realConvexReact)
})
