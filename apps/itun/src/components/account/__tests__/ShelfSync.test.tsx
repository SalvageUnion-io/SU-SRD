import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, render, waitFor } from '@testing-library/react'

/**
 * `ShelfSync` is how one tab hears another's deletes: there is no tab-to-tab
 * channel, so a row deleted in another tab leaves this one only when a later
 * `listMine` emission omits it and the prune forgets it.
 *
 * Each case below serves a row, then serves an emission without it, and pins
 * two things: the row leaves this tab's in-memory store, and no server write is
 * issued for it — the prune `forget`s a copy, it never sends a delete.
 */

import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'
import { FIXTURE_NOW, mechFixture, pilotFixture } from '../../__tests__/fixtures'

const mutations: { name: string; args: unknown }[] = []

const convexMocks = await installConvexMocks({
  convexClient: {
    mutation: async (ref: unknown, args: unknown) => {
      mutations.push({ name: String(ref), args })
      return { updatedAt: 1 }
    },
  },
})

const { ShelfSync } = await import('../ShelfSync')
const { useEntityStore } = await import('../../../stores/entityStore')
const { usePatternStore } = await import('../../../stores/patternStore')
const { useEncounterStore } = await import('../../../stores/encounterStore')
const { forgetVersions } = await import('../../../stores/serverVersions')
const { withSignedInBackend } = await import('../../../stores/__tests__/signedInBackend')
const db = await import('../../../lib/db/index')

afterAll(() => {
  convexMocks.restore()
})

withSignedInBackend()

const EMPTY_ROSTER = {
  pilots: [],
  mechs: [],
  crawlers: [],
  mechPatterns: [],
  encounterNpcs: [],
}

const EMPTY_WIRING = { gameIds: [], softLinks: [], crawlers: [] }

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

/** Serve one `listMine` answer and let this tab's sync settle on it. */
function serve(roster: Partial<typeof EMPTY_ROSTER>) {
  setQueryAnswers({
    'entities:listMine': { ...EMPTY_ROSTER, ...roster },
    'entities:listWiring': EMPTY_WIRING,
  })
}

beforeEach(async () => {
  mutations.length = 0
  forgetVersions()
  db._resetDbSingleton()
  await db.clearCache()
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: true, mechs: true, crawlers: true, softLinks: true },
  })
  usePatternStore.setState({ mechPatterns: [], hydrated: true })
  useEncounterStore.setState({ encounterNpcs: [], hydrated: true })
})

describe('a delete made in another tab leaves this one', () => {
  test('a pattern', async () => {
    serve({ mechPatterns: [{ body: pattern }] as never[] })
    const view = render(<ShelfSync />)
    await waitFor(() => expect(usePatternStore.getState().get('pat-1')).not.toBeNull())

    serve({})
    await act(async () => view.rerender(<ShelfSync />))

    await waitFor(() => expect(usePatternStore.getState().mechPatterns).toEqual([]))
    expect(mutations).toEqual([])
  })

  test('an encounter NPC', async () => {
    serve({ encounterNpcs: [{ body: npc }] as never[] })
    const view = render(<ShelfSync />)
    await waitFor(() => expect(useEncounterStore.getState().get('npc-1')).not.toBeNull())

    serve({})
    await act(async () => view.rerender(<ShelfSync />))

    await waitFor(() => expect(useEncounterStore.getState().encounterNpcs).toEqual([]))
    expect(mutations).toEqual([])
  })

  test('an owned pilot filed in a Game', async () => {
    const pilot = pilotFixture({ id: 'gp-1', gameId: 'g1' })
    serve({ pilots: [{ appId: 'gp-1', updatedAt: 1, body: pilot }] as never[] })
    const view = render(<ShelfSync />)
    await waitFor(() => expect(useEntityStore.getState().get('pilot', 'gp-1')).not.toBeNull())

    serve({})
    await act(async () => view.rerender(<ShelfSync />))

    await waitFor(() => expect(useEntityStore.getState().pilots).toEqual([]))
    expect(mutations).toEqual([])
  })

  test('an owned mech filed in a Game', async () => {
    const mech = mechFixture({ id: 'gm-1', gameId: 'g1' })
    serve({ mechs: [{ appId: 'gm-1', updatedAt: 1, body: mech }] as never[] })
    const view = render(<ShelfSync />)
    await waitFor(() => expect(useEntityStore.getState().get('mech', 'gm-1')).not.toBeNull())

    serve({})
    await act(async () => view.rerender(<ShelfSync />))

    await waitFor(() => expect(useEntityStore.getState().mechs).toEqual([]))
    expect(mutations).toEqual([])
  })
})

describe('what absence alone does not remove', () => {
  test('a Game pilot this browser never knew as the caller’s stays', async () => {
    // An unclaimed pre-gen, say: owned by nobody, so never in `listMine`.
    await useEntityStore.getState().adopt('pilot', pilotFixture({ id: 'pre-1', gameId: 'g1' }))
    serve({})
    render(<ShelfSync />)
    // Let the emission's sync run to completion.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    expect(useEntityStore.getState().get('pilot', 'pre-1')).not.toBeNull()
  })
})
