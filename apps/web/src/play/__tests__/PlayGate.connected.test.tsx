import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createElement } from 'react'

/**
 * `PlayGate` — the body of `/play/$pilotId`, and the one place that decides
 * who may open Play for a pilot: any pilot of yours, in a Game or solo.
 *
 * It refuses an anonymous session, a pilot not found and a non-member; a shelf pilot plays solo and a Game without a Mediator plays too.
 * Offline it opens read-only, and an old mech-keyed URL redirects to the
 * mech's pilot.
 *
 * The Cockpit itself is stubbed: what is under test is whether it opens, and
 * with which `PlayTarget`. Its own test is `PlayCockpit.test.tsx`.
 */

import {
  installConvexMocks,
  queryCalls,
  setQueryAnswers,
} from '../../components/__tests__/convexMock'
import { FIXTURE_NOW, mechFixture, pilotFixture } from '../../components/__tests__/fixtures'
import type { ConnectionMode } from '../../lib/connection/connectionMode'
import type { PlayTarget } from '../play.model'

// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs. See `convexMock.ts`.
const convexMocks = await installConvexMocks({
  router: true,
  also: {
    // Relative to `convexMock.ts`, not this file.
    '../../play/PlayCockpit': () => ({
      PlayCockpit: ({ target }: { target: PlayTarget }) =>
        createElement('p', null, `Cockpit for ${JSON.stringify(target)}`),
    }),
  },
})

const { PlayGate } = await import('../PlayGate')
const { ConnectionContext } = await import('../../lib/connection/connectionContext')
const { hydrateStores } = await import('../../components/__tests__/hydrateStores')
const { useEntityStore } = await import('../../stores/entityStore')
const { setEntityBackendAuthState } = await import('../../stores/entityBackend')

const GAME_ID = 'g-play'
const GAME = { _id: GAME_ID, name: 'Tenacity', mediator: false, organizer: false }

beforeAll(async () => {
  await hydrateStores()
  // Filling the cache only: `adopt` is not a user write, so it needs no account.
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
  const store = useEntityStore.getState()
  await store.adopt('pilot', pilotFixture({ id: 'play-rook', name: 'Rook', gameId: GAME_ID }))
  await store.adopt('pilot', pilotFixture({ id: 'play-wren', name: 'Wren', gameId: null }))
  await store.adopt('mech', mechFixture({ id: 'play-mech', name: 'Thresher', gameId: GAME_ID }))
  await store.adopt('mech', mechFixture({ id: 'play-spare', name: 'Spare', gameId: GAME_ID }))
  await store.adopt('softLink', {
    id: 'play-link',
    type: 'mech-to-pilot',
    from: { type: 'mech', id: 'play-mech' },
    to: { type: 'pilot', id: 'play-rook' },
    createdAt: FIXTURE_NOW,
  })
})

afterAll(async () => {
  // Leave the shared stores as this file found them.
  const store = useEntityStore.getState()
  await store.forget('softLink', 'play-link')
  await store.forget('mech', 'play-mech')
  await store.forget('mech', 'play-spare')
  await store.forget('pilot', 'play-rook')
  await store.forget('pilot', 'play-wren')
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
      <PlayGate id={id} />
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

/** The Cockpit, opened for this target, or null when a shell shows instead. */
function opened(): PlayTarget | null {
  const line = screen.queryByText(/^Cockpit for /)?.textContent
  return line ? (JSON.parse(line.replace('Cockpit for ', '')) as PlayTarget) : null
}

describe('refusals', () => {
  test('an anonymous session is asked to sign in, and asks Convex nothing', async () => {
    setQueryAnswers({})
    await renderGate('play-rook', 'solo')
    expect(heading('Sign in to play')).toBeTruthy()
    expect(queryCalls()).toHaveLength(0)
    expect(opened()).toBeNull()
  })

  test('a viewer who is not a member is refused', async () => {
    setQueryAnswers({ 'games:get': null })
    await renderGate('play-rook')
    expect(heading(/not in this Pilot's Game/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back to Play' }).getAttribute('href')).toBe('/play/')
    expect(opened()).toBeNull()
  })

  test('an id that is neither a pilot nor a mech is not found', async () => {
    setQueryAnswers({})
    await renderGate('play-nobody')
    expect(heading('Pilot not found')).toBeTruthy()
  })

  test('the session still settling waits', async () => {
    setQueryAnswers({})
    await renderGate('play-rook', 'connecting')
    expect(screen.getByText('Loading your session…')).toBeTruthy()
  })
})

describe('Play opens', () => {
  test('solo for a pilot on the shelf, asking Convex nothing', async () => {
    setQueryAnswers({})
    await renderGate('play-wren')
    expect(opened()).toEqual({
      pilotId: 'play-wren',
      gameId: null,
      gameName: null,
      mediator: false,
    })
    expect(queryCalls()).toHaveLength(0)
  })

  test('for a pilot in a Game, with or without a Mediator, under the Game’s name', async () => {
    setQueryAnswers({ 'games:get': GAME })
    await renderGate('play-rook')
    expect(opened()).toEqual({
      pilotId: 'play-rook',
      gameId: GAME_ID,
      gameName: 'Tenacity',
      mediator: false,
    })
    // No roster is asked for: Play does not wait on a Mediator.
    expect(queryCalls().map((c) => c.name)).toEqual(['games:get'])
  })

  test('as the Game’s Mediator, which the target says', async () => {
    setQueryAnswers({ 'games:get': { ...GAME, mediator: true } })
    await renderGate('play-rook')
    expect(opened()?.mediator).toBe(true)
  })

  test('read-only while Disconnected, even before the Game has answered', async () => {
    setQueryAnswers({ 'games:get': undefined })
    await renderGate('play-rook', 'disconnected')
    expect(opened()).toEqual({
      pilotId: 'play-rook',
      gameId: GAME_ID,
      gameName: null,
      mediator: false,
    })
  })

  test('but waits for the Game while connected', async () => {
    setQueryAnswers({ 'games:get': undefined })
    await renderGate('play-rook')
    expect(screen.getByText('Loading the Game…')).toBeTruthy()
    expect(opened()).toBeNull()
  })
})

describe('old mech-keyed URLs', () => {
  test("redirect to the mech's pilot", async () => {
    convexMocks.navigations.length = 0
    setQueryAnswers({ 'games:get': GAME })
    await renderGate('play-mech')
    expect(convexMocks.navigations).toEqual([
      { to: '/play/$pilotId', params: { pilotId: 'play-rook' }, replace: true },
    ])
    expect(opened()?.pilotId).toBe('play-rook')
  })

  test('a mech with no pilot says so, and goes nowhere', async () => {
    convexMocks.navigations.length = 0
    setQueryAnswers({})
    await renderGate('play-spare')
    expect(heading('Spare has no Pilot')).toBeTruthy()
    expect(convexMocks.navigations).toHaveLength(0)
  })
})
