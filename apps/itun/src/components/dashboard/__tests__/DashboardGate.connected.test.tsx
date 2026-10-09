import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createElement } from 'react'

/**
 * `DashboardGate` — the body of `/dashboard/$pilotId`, and the one place that
 * decides who may open the Dashboard (ADR-038 §1).
 *
 * One test per refusal the plan names (anonymous, shelf pilot, non-member, no
 * Mediator), the live fall-back when the Mediator is removed while the
 * Dashboard is open, the redirect from an old mech-keyed URL, and the
 * Disconnected case, which is not a refusal.
 *
 * Queries are answered by name (`convexMock.ts`). This surface asks for
 * games.get and games.members, and only once the pilot is in a Game.
 *
 * The Dashboard itself is stubbed: what is under test is whether it opens,
 * and for which pilot. Its own smoke test is `Dashboard.test.tsx`.
 */

import type { ConnectionMode } from '../../../lib/connection/connectionMode'
import { installConvexMocks, queryCalls, setQueryAnswers } from '../../__tests__/convexMock'
import { FIXTURE_NOW, mechFixture, pilotFixture } from '../../__tests__/fixtures'

// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs. See `convexMock.ts`.
const convexMocks = await installConvexMocks({
  router: true,
  also: {
    // Relative to `convexMock.ts`, not this file.
    '../dashboard/Dashboard': () => ({
      Dashboard: ({ pilotId }: { pilotId: string }) =>
        createElement('p', null, `Dashboard for ${pilotId}`),
    }),
  },
})

const { DashboardGate } = await import('../DashboardGate')
const { ConnectionContext } = await import('../../../lib/connection/connectionContext')
const { hydrateStores } = await import('../../__tests__/hydrateStores')
const { useEntityStore } = await import('../../../stores/entityStore')
const { setEntityBackendAuthState } = await import('../../../stores/entityBackend')

const GAME_ID = 'g-gate'
const GAME = { _id: GAME_ID, name: 'Tenacity', mediator: false, organizer: false }
const WITH_MEDIATOR = [
  { userId: 'u-med', displayName: 'Mediator', mediator: true, organizer: true },
  { userId: 'u-me', displayName: 'Me', mediator: false, organizer: false },
]
const NO_MEDIATOR = [
  { userId: 'u-org', displayName: 'Organizer', mediator: false, organizer: true },
  { userId: 'u-me', displayName: 'Me', mediator: false, organizer: false },
]

beforeAll(async () => {
  await hydrateStores()
  // Filling the cache only: `adopt` is not a user write, so it needs no account.
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
  const store = useEntityStore.getState()
  await store.adopt('pilot', pilotFixture({ id: 'gate-rook', name: 'Rook', gameId: GAME_ID }))
  await store.adopt('pilot', pilotFixture({ id: 'gate-shelf', name: 'Wren', gameId: null }))
  await store.adopt('mech', mechFixture({ id: 'gate-mech', name: 'Thresher', gameId: GAME_ID }))
  await store.adopt('mech', mechFixture({ id: 'gate-spare', name: 'Spare', gameId: GAME_ID }))
  await store.adopt('softLink', {
    id: 'gate-link',
    type: 'mech-to-pilot',
    from: { type: 'mech', id: 'gate-mech' },
    to: { type: 'pilot', id: 'gate-rook' },
    createdAt: FIXTURE_NOW,
  })
})

afterAll(async () => {
  // Leave the shared stores as this file found them.
  const store = useEntityStore.getState()
  await store.forget('mech', 'gate-mech')
  await store.forget('mech', 'gate-spare')
  await store.forget('pilot', 'gate-rook')
  await store.forget('pilot', 'gate-shelf')
  convexMocks.restore()
})

function connection(mode: ConnectionMode) {
  return {
    mode,
    canWrite: mode === 'connected' || mode === 'solo',
    showDisconnectedWarning: mode === 'disconnected',
    settling: mode === 'connecting',
  }
}

function gate(id: string, mode: ConnectionMode): ReactNode {
  return (
    <ConnectionContext.Provider value={connection(mode)}>
      <DashboardGate id={id} />
    </ConnectionContext.Provider>
  )
}

async function renderGate(id: string, mode: ConnectionMode = 'connected') {
  let result: ReturnType<typeof render> | undefined
  await act(async () => {
    result = render(gate(id, mode))
  })
  if (result === undefined) throw new Error('render did not run')
  return result
}

const heading = (name: string | RegExp) => screen.getByRole('heading', { name })
/** The Dashboard itself, rather than a shell, and for Rook. */
const dashboardOpen = () => screen.queryByText('Dashboard for gate-rook') !== null

describe('refusals', () => {
  test('an anonymous session is asked to sign in, and asks Convex nothing', async () => {
    setQueryAnswers({})
    await renderGate('gate-rook', 'solo')
    expect(heading('Sign in to play')).toBeTruthy()
    expect(queryCalls()).toHaveLength(0)
    expect(dashboardOpen()).toBe(false)
  })

  test('a shelf pilot is told to move into a Game', async () => {
    setQueryAnswers({})
    await renderGate('gate-shelf')
    expect(heading('Move Wren into a Game to play')).toBeTruthy()
    // The live sheet is where a shelf pilot is played.
    expect(screen.getByRole('link', { name: /Wren's live sheet/ }).getAttribute('href')).toBe(
      '/sheet/pilot/gate-shelf'
    )
    expect(dashboardOpen()).toBe(false)
  })

  test('a viewer who is not a member is refused, and the roster is never asked for', async () => {
    setQueryAnswers({ 'games:get': null })
    await renderGate('gate-rook')
    expect(heading(/not in this pilot's Game/)).toBeTruthy()
    // `members` throws for a non-member; `get` answering null is the signal.
    expect(queryCalls().map((c) => c.name)).toEqual(['games:get'])
    expect(dashboardOpen()).toBe(false)
  })

  test('a Game with no Mediator is refused with the way forward', async () => {
    setQueryAnswers({ 'games:get': GAME, 'games:members': NO_MEDIATOR })
    await renderGate('gate-rook')
    expect(heading('This Game has no Mediator')).toBeTruthy()
    expect(screen.getByText('Ask the Organizer to name one, or edit your live sheet.')).toBeTruthy()
    expect(dashboardOpen()).toBe(false)
  })
})

describe('the Dashboard opens', () => {
  test('for a pilot in a Game with a Mediator', async () => {
    setQueryAnswers({ 'games:get': GAME, 'games:members': WITH_MEDIATOR })
    await renderGate('gate-rook')
    expect(dashboardOpen()).toBe(true)
    expect(queryCalls().find((c) => c.name === 'games:get')?.args).toEqual({ gameId: GAME_ID })
  })

  test('and falls back to the shell when the Mediator is removed while it is open', async () => {
    setQueryAnswers({ 'games:get': GAME, 'games:members': WITH_MEDIATOR })
    const { rerender } = await renderGate('gate-rook')
    expect(dashboardOpen()).toBe(true)

    // The reactive `members` query answers again without the Mediator.
    setQueryAnswers({ 'games:get': GAME, 'games:members': NO_MEDIATOR })
    await act(async () => {
      rerender(gate('gate-rook', 'connected'))
    })
    expect(heading('This Game has no Mediator')).toBeTruthy()
    expect(dashboardOpen()).toBe(false)
  })

  test('read-only while Disconnected, even before the Game has answered', async () => {
    // Offline, the queries cannot answer until the connection is back.
    setQueryAnswers({ 'games:get': undefined })
    await renderGate('gate-rook', 'disconnected')
    expect(dashboardOpen()).toBe(true)
  })

  test('but waits for the Game while connected', async () => {
    setQueryAnswers({ 'games:get': undefined })
    await renderGate('gate-rook')
    expect(screen.getByText('Loading the Game…')).toBeTruthy()
    expect(dashboardOpen()).toBe(false)
  })
})

describe('old mech-keyed URLs', () => {
  test("redirect to the mech's pilot", async () => {
    convexMocks.navigations.length = 0
    setQueryAnswers({ 'games:get': GAME, 'games:members': WITH_MEDIATOR })
    await renderGate('gate-mech')
    expect(convexMocks.navigations).toEqual([
      { to: '/dashboard/$pilotId', params: { pilotId: 'gate-rook' }, replace: true },
    ])
    // The pilot's own gate answers in the meantime.
    expect(dashboardOpen()).toBe(true)
  })

  test('a mech with no pilot says so, and goes nowhere', async () => {
    convexMocks.navigations.length = 0
    setQueryAnswers({})
    await renderGate('gate-spare')
    expect(heading('Spare has no pilot')).toBeTruthy()
    expect(convexMocks.navigations).toHaveLength(0)
  })

  test('an id that is neither is not found', async () => {
    setQueryAnswers({})
    await renderGate('gate-nobody')
    expect(heading('Pilot not found')).toBeTruthy()
  })
})
