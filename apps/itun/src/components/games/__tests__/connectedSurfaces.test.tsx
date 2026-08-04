import { afterAll, describe, expect, mock, test } from 'bun:test'
import { render, screen } from '@testing-library/react'

/**
 * The Game surfaces in their **connected** state.
 *
 * Every other test of these components exercises the Solo path, because the
 * test build has no `VITE_CONVEX_URL`. That proves they do not crash without a
 * provider — but it leaves the branch people actually use untested, which is
 * where the interesting behaviour lives: how an unclaimed pilot reads, what a
 * missing vital renders as, whether a non-Mediator can see the opposition.
 *
 * Both the Convex hooks and the build-time `isConvexConfigured` flag are mocked
 * so the connected branch renders. `mock.module` is file-scoped in Bun, so
 * these live together rather than being spread across the component files.
 */

/**
 * Queries are answered **by name** (`getFunctionName`) — see `convexMock.ts`.
 * This file renders three different components, so a positional queue meant
 * three separate implicit orderings to keep straight.
 */
import { convexReactMock, setQueryAnswers } from '../../__tests__/convexMock'
import type { QueryAnswers } from '../../__tests__/convexMock'

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

mock.module('convex/react', () => convexReactMock())

const { CrewVitals } = await import('../CrewVitals')
const { DowntimePanel } = await import('../DowntimePanel')
const { ProposalInbox } = await import('../ProposalInbox')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')

/** Answer this component's useQuery calls, keyed by `<module>:<export>`. */
function withQueries(answers: QueryAnswers): void {
  setQueryAnswers(answers)
}

/** DowntimePanel asks for the phase state and whether the viewer mediates. */
function downtimeQueries(state: unknown, amMediator: boolean): QueryAnswers {
  return { 'downtime:state': state, 'mediator:amMediator': amMediator }
}

const wrap = (ui: React.ReactNode) => render(<ConnectionProvider>{ui}</ConnectionProvider>)

describe('CrewVitals', () => {
  test('an unclaimed pilot reads as Unclaimed, not as a blank', () => {
    withQueries({
      'crew:vitals': {
        viewerId: 'u1',
        pilots: [
          {
            _id: 'p1',
            appId: null,
            ownerId: null,
            ownerName: null,
            name: 'Pre-gen',
            currentHp: 10,
            currentAp: 5,
          },
        ],
        mechs: [],
      },
    })
    wrap(<CrewVitals gameId={'g1' as never} />)

    // A pre-gen waiting to be handed out is available, not broken.
    expect(screen.getByText('Unclaimed')).toBeTruthy()
  })

  test('a missing vital renders as a dash, never as zero', () => {
    withQueries({
      'crew:vitals': {
        viewerId: 'u1',
        pilots: [
          {
            _id: 'p1',
            appId: null,
            ownerId: 'u2',
            ownerName: 'Beefcake',
            name: 'Roach-Boy',
            currentHp: null,
            currentAp: null,
          },
        ],
        mechs: [],
      },
    })
    wrap(<CrewVitals gameId={'g1' as never} />)

    // Zero would read as DEAD on a vitals strip, which is worse than blank.
    expect(screen.getByText(/HP — · AP —/)).toBeTruthy()
    expect(screen.getByText('Beefcake')).toBeTruthy()
  })

  test('an empty game says so rather than rendering nothing', () => {
    withQueries({ 'crew:vitals': { viewerId: 'u1', pilots: [], mechs: [] } })
    wrap(<CrewVitals gameId={'g1' as never} />)
    expect(screen.getByText(/No pilots in this game yet/i)).toBeTruthy()
  })

  test('while loading it says so', () => {
    withQueries({ 'crew:vitals': undefined })
    wrap(<CrewVitals gameId={'g1' as never} />)
    expect(screen.getByText(/Loading the crew/i)).toBeTruthy()
  })
})

describe('DowntimePanel', () => {
  test('not running, and a non-Mediator is offered no phase controls', () => {
    withQueries(
      downtimeQueries(
        { running: false, stepIndex: null, completedBy: [], upkeepSpent: false },
        false
      )
    )
    wrap(<DowntimePanel gameId={'g1' as never} />)

    expect(screen.getByText(/Not running/i)).toBeTruthy()
    expect(screen.queryByText('Begin Downtime')).toBeNull()
  })

  test('the Mediator can begin it', () => {
    withQueries(
      downtimeQueries(
        { running: false, stepIndex: null, completedBy: [], upkeepSpent: false },
        true
      )
    )
    wrap(<DowntimePanel gameId={'g1' as never} />)
    expect(screen.getByText('Begin Downtime')).toBeTruthy()
  })

  test('running: shows the step, who has finished, and upkeep state', () => {
    withQueries(
      downtimeQueries(
        {
          running: true,
          stepIndex: 2,
          completedBy: [{ userId: 'u2', displayName: 'Beefcake' }],
          upkeepSpent: true,
        },
        true
      )
    )
    wrap(<DowntimePanel gameId={'g1' as never} />)

    // stepIndex is zero-based on the wire and one-based on screen.
    expect(screen.getByText('Step 3')).toBeTruthy()
    expect(screen.getByText('Beefcake')).toBeTruthy()
    expect(screen.getByText('Upkeep paid')).toBeTruthy()
  })

  test('nobody finished yet says so rather than showing an empty list', () => {
    withQueries(
      downtimeQueries({ running: true, stepIndex: 0, completedBy: [], upkeepSpent: false }, false)
    )
    wrap(<DowntimePanel gameId={'g1' as never} />)

    expect(screen.getByText(/Nobody yet/i)).toBeTruthy()
    expect(screen.getByText('Upkeep outstanding')).toBeTruthy()
  })
})

describe('ProposalInbox', () => {
  test('renders nothing when there is nothing to answer', () => {
    withQueries({ 'proposals:pending': [] })
    const { container } = wrap(<ProposalInbox gameId={'g1' as never} />)
    // An empty inbox should not occupy space on a play surface.
    expect(container.innerHTML).toBe('')
  })

  test('shows before and after so a mismatch is visible', () => {
    withQueries({
      'proposals:pending': [
        {
          _id: 'c1',
          entityId: 'm1',
          entityType: 'mech',
          field: 'currentSp',
          before: 10,
          after: 6,
          ts: 1,
        },
      ],
    })
    wrap(<ProposalInbox gameId={'g1' as never} />)

    // The Mediator's `before` is what THEY believed; showing it lets the table
    // spot a disagreement rather than having the UI paper over it.
    expect(screen.getByText('10 → 6')).toBeTruthy()
    expect(screen.getByText('Apply')).toBeTruthy()
    // Decline is a peer, not a dismissal.
    expect(screen.getByText('Decline')).toBeTruthy()
  })

  test('a null before renders as a dash rather than "null"', () => {
    withQueries({
      'proposals:pending': [
        {
          _id: 'c1',
          entityId: 'm1',
          entityType: 'mech',
          field: 'currentSp',
          before: null,
          after: 6,
          ts: 1,
        },
      ],
    })
    wrap(<ProposalInbox gameId={'g1' as never} />)
    expect(screen.getByText('— → 6')).toBeTruthy()
  })
})

afterAll(() => {
  mock.module('../../../lib/connection/convexClient', () => realConvexClient)
  mock.module('convex/react', () => realConvexReact)
})
