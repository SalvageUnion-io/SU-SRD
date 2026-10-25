import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, render, waitFor } from '@testing-library/react'

/**
 * `ReplicaSync` and its feed (`ConvexFeed`): live, each answer is one scope's
 * snapshot, so a row another tab deleted leaves this one when an answer omits
 * it, and no server write is sent for it. Signed out after a session, every
 * held row goes.
 */

import { installConvexMocks, setQueryAnswers } from '../../components/__tests__/convexMock'
import {
  crawlerFixture,
  FIXTURE_NOW,
  mechFixture,
  pilotFixture,
} from '../../components/__tests__/fixtures'
import type { SyncStatus } from '../sync'

const mutations: { name: string; args: unknown }[] = []

const convexMocks = await installConvexMocks({
  convexClient: {
    mutation: async (ref: unknown, args: unknown) => {
      mutations.push({ name: String(ref), args })
      return { updatedAt: 1 }
    },
  },
})

const { ReplicaSync } = await import('../ReplicaSync')
const { SyncContext } = await import('../syncContext')
const { useUnits } = await import('../units')
const { usePatterns, useTray, useEncounters } = await import('../collections')
const { getView, hold } = await import('../replica')
const { resetPersist, setReplicaStorage } = await import('../persist')
const { resetStores } = await import('./resetStores')
const { resetSync, setSyncStatus } = await import('../sync')

afterAll(() => {
  convexMocks.restore()
})

const EMPTY_ROSTER = {
  pilots: [],
  mechs: [],
  crawlers: [],
  npcs: [],
  mechPatterns: [],
  encounterNpcs: [],
}

const pattern = {
  id: 'pat-1',
  schemaVersion: 1,
  name: 'Mule Pattern',
  chassisRef: 'mule',
  systems: [],
  modules: [],
  cargoLots: [],
  createdAt: FIXTURE_NOW,
}

const npc = {
  id: 'npc-1',
  schemaVersion: 1,
  gameId: null,
  refSchema: 'npcs',
  refSlug: 'bandit',
  refName: 'Bandit',
  name: 'Bandit 1',
  currentHp: 4,
  maxHp: 4,
  statKind: 'hp',
  conditions: [],
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
}

const encounter = {
  id: 'enc-1',
  schemaVersion: 1,
  name: 'Ambush',
  opposition: [],
  tables: [],
  notes: '',
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
}

type Wiring = { gameIds: string[]; softLinks: unknown[]; crawlers: unknown[] }

/** Serve one answer from each live query. */
function answer(
  roster: Partial<typeof EMPTY_ROSTER>,
  encounters: unknown[] = [],
  wiring: Wiring = { gameIds: [], softLinks: [], crawlers: [] }
) {
  setQueryAnswers({
    'entities:listMine': { ...EMPTY_ROSTER, ...roster },
    'entities:listWiring': wiring,
    'shelf:encounters': encounters,
  })
}

function tree(status: SyncStatus, outdated = false) {
  return (
    <SyncContext.Provider value={{ status, canWrite: status === 'live' && !outdated, outdated }}>
      <ReplicaSync />
    </SyncContext.Provider>
  )
}

beforeEach(() => {
  mutations.length = 0
  resetStores()
})
afterEach(() => {
  resetPersist()
  setReplicaStorage(null)
  localStorage.clear()
  resetSync()
})

describe('the first answer', () => {
  test('hydrate resolves only once every feed has answered, with its rows', async () => {
    answer({ pilots: [{ appId: 'p1', updatedAt: 1, body: pilotFixture({ id: 'p1' }) }] as never[] })
    let arrived = false
    render(tree('live'))
    const waiting = Promise.all([
      useUnits.getState().hydrate('pilot'),
      useUnits.getState().hydrate('softLink'),
      usePatterns.getState().hydrate(),
      useTray.getState().hydrate(),
      useEncounters.getState().hydrate(),
    ]).then(() => {
      arrived = true
    })

    await act(async () => {
      await waiting
    })
    expect(arrived).toBe(true)
    expect(
      useUnits
        .getState()
        .list('pilot')
        .map((p) => p.id)
    ).toEqual(['p1'])
  })

  test('a Game crawler is held under its row’s Game', async () => {
    // A template-seeded body names no Game: the row's column is the authority.
    const body = crawlerFixture({ id: 'c1', gameId: null })
    answer({}, [], {
      gameIds: ['g1'],
      softLinks: [],
      crawlers: [{ appId: 'c1', gameId: 'g1', updatedAt: 2, body }],
    })
    render(tree('live'))
    await waitFor(() => expect(useUnits.getState().get('crawler', 'c1')?.gameId).toBe('g1'))
  })
})

describe('a delete made in another tab leaves this one', () => {
  const cases = [
    {
      name: 'an encounter on the shelf',
      served: () => answer({}, [{ body: encounter, updatedAt: 1 }]),
      held: () => useEncounters.getState().get('enc-1'),
    },
    {
      name: 'a pattern',
      served: () => answer({ mechPatterns: [{ body: pattern }] as never[] }),
      held: () => usePatterns.getState().get('pat-1'),
    },
    {
      name: 'an encounter NPC',
      served: () => answer({ encounterNpcs: [{ body: npc }] as never[] }),
      held: () => useTray.getState().get('npc-1'),
    },
    {
      name: 'an owned pilot filed in a Game',
      served: () =>
        answer({
          pilots: [
            { appId: 'gp-1', updatedAt: 1, body: pilotFixture({ id: 'gp-1', gameId: 'g1' }) },
          ] as never[],
        }),
      held: () => useUnits.getState().get('pilot', 'gp-1'),
    },
    {
      name: 'an owned mech filed in a Game',
      served: () =>
        answer({
          mechs: [
            { appId: 'gm-1', updatedAt: 1, body: mechFixture({ id: 'gm-1', gameId: 'g1' }) },
          ] as never[],
        }),
      held: () => useUnits.getState().get('mech', 'gm-1'),
    },
  ]
  for (const c of cases) {
    test(c.name, async () => {
      c.served()
      const view = render(tree('live'))
      await waitFor(() => expect(c.held()).not.toBeNull())

      answer({})
      await act(async () => view.rerender(tree('live')))

      await waitFor(() => expect(c.held()).toBeNull())
      expect(mutations).toEqual([])
    })
  }
})

describe('the session', () => {
  test('signing out drops every held row', async () => {
    const view = render(tree('offline'))
    hold('pilot', pilotFixture({ id: 'p1' }), { version: 1 })
    expect(getView().pilots).toHaveLength(1)

    await act(async () => view.rerender(tree('signedOut')))

    expect(getView().pilots).toEqual([])
  })

  test('booted offline with a session, the device’s copy is the answer', async () => {
    const sub = btoa(JSON.stringify({ sub: 'u1|s1' }))
    localStorage.setItem('__convexAuthJWT_test', `h.${sub}.s`)
    const kept = {
      table: 'pilot' as const,
      id: 'p1',
      row: pilotFixture({ id: 'p1', name: 'Kept' }),
      version: 1,
      headSeq: 1,
      scopes: ['account' as const],
    }
    setReplicaStorage({
      account: async () => 'u1',
      rows: async () => [kept],
      write: async () => {},
      drop: async () => {},
    })

    // What `SyncProvider` publishes to the replica's writers.
    setSyncStatus('offline')
    render(tree('offline'))

    await act(async () => {
      await useUnits.getState().hydrate('pilot')
    })
    expect(getView().pilots.map((p) => p.name)).toEqual(['Kept'])
    expect(getView().hydrated.mechs).toBe(true)
  })

  test('offline or outdated, nothing is fed', async () => {
    answer({ pilots: [{ appId: 'p1', updatedAt: 1, body: pilotFixture({ id: 'p1' }) }] as never[] })
    const view = render(tree('offline'))
    await act(async () => view.rerender(tree('live', true)))
    expect(getView().pilots).toEqual([])
  })
})
