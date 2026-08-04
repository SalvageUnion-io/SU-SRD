import { afterAll, afterEach, describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'

/**
 * The one-time "bring your local data into your account" prompt (D11), for
 * somebody who has an account. The Solo case lives next door and asserts
 * silence.
 *
 * This is the only path from a pre-accounts IndexedDB roster into an account,
 * so the failure modes are the expensive kind: never offering it strands
 * somebody's builds on one device, and offering it twice duplicates their whole
 * roster. Both are covered here, along with the promises the copy makes — that
 * nothing local is removed, and that the copy lands on the shelf rather than in
 * somebody's game.
 *
 * `ClaimLocalData` calls no `useQuery` at all. It still goes through the shared
 * name-keyed mock (see `convexMock.ts`) rather than a blanket
 * `() => undefined`, so if it ever grows a query the test fails loudly instead
 * of silently rendering that query's loading state forever.
 */

import { convexReactMock, setQueryAnswers } from '../../__tests__/convexMock'

let authed = true
let claimResult: unknown = { claimed: 0, skipped: 0, byKind: {} }
let pilots: unknown[] = []
let mechs: unknown[] = []
let crawlers: unknown[] = []
let patterns: unknown[] = []

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
const realEntityStore = { ...(await import('../../../stores/entityStore')) }
const realPatternStore = { ...(await import('../../../stores/patternStore')) }

mock.module('../../../lib/connection/convexClient', () => ({
  isConvexConfigured: true,
  convexClient: {},
}))

mock.module('convex/react', () =>
  convexReactMock({
    useMutation: () => async () => claimResult,
    useConvexAuth: () => ({ isAuthenticated: authed, isLoading: false }),
  })
)

// No queries: this component asks the server nothing.
setQueryAnswers({})

/**
 * The stores are stubbed rather than seeded through IndexedDB: what is under
 * test is the prompt's arithmetic and its one-time marker, not hydration.
 */
mock.module('../../../stores/entityStore', () => ({
  useEntityStore: (selector: (s: unknown) => unknown) =>
    selector({
      list: (kind: string) => {
        if (kind === 'pilot') return pilots
        if (kind === 'mech') return mechs
        if (kind === 'crawler') return crawlers
        return []
      },
    }),
}))

mock.module('../../../stores/patternStore', () => ({
  usePatternStore: (selector: (s: unknown) => unknown) => selector({ mechPatterns: patterns }),
}))

const { ClaimLocalData } = await import('../ClaimLocalData')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')

const wrap = () =>
  render(
    <ConnectionProvider>
      <ClaimLocalData />
    </ConnectionProvider>
  )

/** A roster of the given sizes, shaped only as far as the prompt reads it. */
function localRoster(p = 2, m = 1, c = 1, pat = 3): void {
  pilots = Array.from({ length: p }, (_, i) => ({ id: `p${i}` }))
  mechs = Array.from({ length: m }, (_, i) => ({ id: `m${i}` }))
  crawlers = Array.from({ length: c }, (_, i) => ({ id: `c${i}` }))
  patterns = Array.from({ length: pat }, (_, i) => ({ id: `pat${i}` }))
}

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

afterEach(() => {
  authed = true
  pilots = []
  mechs = []
  crawlers = []
  patterns = []
  claimResult = { claimed: 0, skipped: 0, byKind: {} }
  setOnline(true)
  localStorage.clear()
})

describe('when the prompt is offered at all', () => {
  test('an empty device is never asked', () => {
    // Nothing to carry, so the prompt would be pure noise on a new account.
    wrap()
    expect(screen.queryByText(/Bring your builds with you/i)).toBeNull()
  })

  test('a device with a roster is asked', () => {
    localRoster()
    wrap()
    expect(screen.getByText(/Bring your builds with you/i)).toBeTruthy()
  })

  test('solo is never asked — there is no account to claim into', () => {
    authed = false
    localRoster()
    wrap()
    expect(screen.queryByText(/Bring your builds with you/i)).toBeNull()
  })

  test('disconnected is never asked — the button would fail on click', () => {
    setOnline(false)
    localRoster()
    wrap()
    expect(screen.queryByText(/Bring your builds with you/i)).toBeNull()
  })
})

describe('what the prompt says it will do', () => {
  test('it counts what is here, pluralised', () => {
    localRoster(2, 1, 1, 3)
    wrap()
    expect(screen.getByText(/2 pilots, 1 mech, 1 crawler and 3 saved patterns/)).toBeTruthy()
  })

  test('a single item of each reads as singular', () => {
    localRoster(1, 1, 1, 1)
    wrap()
    expect(screen.getByText(/1 pilot, 1 mech, 1 crawler and 1 saved pattern/)).toBeTruthy()
  })

  test('it promises the shelf, not a game, and that nothing local is removed', () => {
    // Both promises are load-bearing: uploading a roster straight into somebody
    // else's game, or moving it off the device, would be a decision made with
    // their data rather than by them.
    localRoster()
    wrap()
    expect(screen.getByText(/land on your shelf — not in any game/i)).toBeTruthy()
    expect(screen.getByText(/Nothing on this device is changed or removed/i)).toBeTruthy()
  })

  test('Not now dismisses it without claiming', () => {
    localRoster()
    wrap()
    fireEvent.click(screen.getByText('Not now'))
    expect(screen.queryByText(/Bring your builds with you/i)).toBeNull()
  })
})

describe('after copying', () => {
  test('it reports how much arrived', async () => {
    localRoster(2, 1, 1, 3)
    claimResult = { claimed: 7, skipped: 0, byKind: {} }
    wrap()

    await act(async () => {
      fireEvent.click(screen.getByText('Copy to my account'))
    })

    expect(screen.getByText(/Copied 7 items to your account/)).toBeTruthy()
  })

  test('anything unreadable is named, and said to still be here', async () => {
    // Silence would read as data loss; the point is that the local copy is
    // still intact and still exportable.
    localRoster()
    claimResult = { claimed: 5, skipped: 2, byKind: {} }
    wrap()

    await act(async () => {
      fireEvent.click(screen.getByText('Copy to my account'))
    })

    expect(screen.getByText(/2 could not be read and were left on this device/)).toBeTruthy()
  })

  test('it is not offered a second time', async () => {
    localRoster()
    claimResult = { claimed: 4, skipped: 0, byKind: {} }
    wrap()

    await act(async () => {
      fireEvent.click(screen.getByText('Copy to my account'))
    })

    // Claiming twice would insert a second copy of the whole roster, because
    // the mutation inserts and the local records keep their ids.
    const second = wrap()
    expect(second.container.innerHTML).toBe('')
  })
})

afterAll(() => {
  mock.module('../../../lib/connection/convexClient', () => realConvexClient)
  mock.module('convex/react', () => realConvexReact)
  mock.module('../../../stores/entityStore', () => realEntityStore)
  mock.module('../../../stores/patternStore', () => realPatternStore)
})
