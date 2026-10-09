import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, render, waitFor } from '@testing-library/react'
import { getFunctionName } from 'convex/server'
import type { ReactElement } from 'react'

/**
 * The cache follows the signed-in account (`AccountReconciler`).
 *
 * What these pin is behaviour a player can see or lose work to: signed out it
 * renders nothing; signed in, the cache is made this account's before anything
 * syncs into it, and then follows the server — and nothing in it is ever sent
 * up, whoever's rows it holds.
 *
 * Queries are answered by name and mutations are recorded by name — see
 * `convexMock.ts` for the capture/restore discipline.
 */

import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'
import { pilotFixture } from '../../__tests__/fixtures'

let authed = false
const mutations: { name: string; args: Record<string, unknown> }[] = []

const convexMocks = await installConvexMocks({
  convexReact: {
    useConvexAuth: () => ({ isAuthenticated: authed, isLoading: false }),
    useMutation: (ref: unknown) => async (args: Record<string, unknown>) => {
      mutations.push({ name: getFunctionName(ref as never), args })
      return null
    },
  },
})

const { AccountReconciler } = await import('../AccountReconciler')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')
const { useEntityStore } = await import('../../../stores/entityStore')
const { setEntityBackendAuthState } = await import('../../../stores/entityBackend')
const db = await import('../../../lib/db/index')

afterAll(() => {
  convexMocks.restore()
})

/** Sign out, and let the signed-out render settle. */
async function signOut(view: { rerender: (ui: ReactElement) => void }): Promise<void> {
  authed = false
  view.rerender(<Tree />)
  await act(async () => {
    await Promise.resolve()
  })
}

const Tree = () => (
  <ConnectionProvider>
    <AccountReconciler />
  </ConnectionProvider>
)

const EMPTY_ROSTER = {
  pilots: [],
  mechs: [],
  crawlers: [],
  mechPatterns: [],
  encounterNpcs: [],
}

/** `ShelfSync` also mounts `WiringSync`, which reads assignments and Game crawlers. */
const EMPTY_WIRING = { gameIds: [], softLinks: [], crawlers: [] }

/** Who is signed in, as `account.me` answers. */
function me(id: string) {
  return { _id: id, displayName: id, avatarUrl: null, email: null }
}

/** The answers every signed-in render needs, as `user-a` with an empty account. */
function answers(over: Record<string, unknown> = {}) {
  return {
    'account:me': me('user-a'),
    'entities:listMine': EMPTY_ROSTER,
    'entities:listWiring': EMPTY_WIRING,
    ...over,
  }
}

beforeEach(async () => {
  authed = false
  mutations.length = 0
  db._resetDbSingleton()
  await db.clearCache()
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: true, mechs: true, crawlers: true, softLinks: true },
  })
  setQueryAnswers(answers())
})

afterEach(() => {
  // Process-global; a leaked signed-in state would change what every later
  // file exercises.
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
})

describe('signed out', () => {
  test('rows on the device: nothing is rendered, and nothing is sent', async () => {
    await db.pilots.put(pilotFixture({ id: 'disk-1' }))
    const { container } = render(<Tree />)
    await act(async () => {
      await Promise.resolve()
    })

    expect(container.textContent).toBe('')
    expect(mutations).toEqual([])
  })
})

describe('signed in, the cache follows the account', () => {
  test('a cache that is nobody’s is emptied, not sent', async () => {
    // What an upgrade leaves, or a browser that held rows before accounts:
    // the server refills the cache, and nothing on the device goes up.
    await db.pilots.put(pilotFixture({ id: 'disk-1' }))
    authed = true
    render(<Tree />)

    await waitFor(async () => expect(await db.readCacheMeta()).toEqual({ userId: 'user-a' }))
    expect(await db.pilots.list()).toEqual([])
    expect(mutations).toEqual([])
  })

  test('a build deleted on another device leaves this cache', async () => {
    await db.writeCacheMeta({ userId: 'user-a' })
    await db.pilots.put(pilotFixture({ id: 'p1' }))
    useEntityStore.setState({ pilots: [pilotFixture({ id: 'p1' })] })
    authed = true
    render(<Tree />)

    await waitFor(async () => expect(await db.pilots.list()).toEqual([]))
    expect(mutations).toEqual([])
  })

  test('a second account on this browser gets none of the first account’s rows', async () => {
    await db.writeCacheMeta({ userId: 'user-a' })
    await db.pilots.put(pilotFixture({ id: 'a-1' }))
    useEntityStore.setState({ pilots: [pilotFixture({ id: 'a-1' })] })
    setQueryAnswers(answers({ 'account:me': me('user-b') }))
    authed = true
    render(<Tree />)

    await waitFor(async () => expect(await db.readCacheMeta()).toEqual({ userId: 'user-b' }))
    expect(await db.pilots.list()).toEqual([])
    await waitFor(() => expect(useEntityStore.getState().pilots).toEqual([]))
    expect(mutations).toEqual([])
  })

  test('a sign-out in another tab drops the rows this tab loaded', async () => {
    // There is no tab-to-tab channel: this tab sees only its own session end.
    // The tab that signed out empties the shared database; this one must
    // still let go of what it holds in memory.
    await db.writeCacheMeta({ userId: 'user-a' })
    setQueryAnswers(
      answers({
        'entities:listMine': {
          ...EMPTY_ROSTER,
          pilots: [{ appId: 'p1', updatedAt: 1, body: pilotFixture({ id: 'p1' }) }],
        },
      })
    )
    authed = true
    const view = render(<Tree />)
    await waitFor(() => expect(useEntityStore.getState().pilots.map((p) => p.id)).toEqual(['p1']))

    await signOut(view)

    await waitFor(() => expect(useEntityStore.getState().pilots).toEqual([]))
    // The database is the signing-out tab's to empty, not this one's.
    expect((await db.pilots.list()).map((p) => p.id)).toEqual(['p1'])
  })

  test('a newer version of a cached build is adopted, though no id changed', async () => {
    await db.writeCacheMeta({ userId: 'user-a' })
    const served = (name: string, updatedAt: number) =>
      answers({
        'entities:listMine': {
          ...EMPTY_ROSTER,
          pilots: [{ appId: 'p1', updatedAt, body: pilotFixture({ id: 'p1', name }) }],
        },
      })
    setQueryAnswers(served('Before', 1))
    authed = true
    const view = render(<Tree />)
    await waitFor(async () => expect((await db.pilots.get('p1'))?.name).toBe('Before'))

    // Edited on another device: same id, newer row.
    setQueryAnswers(served('After', 2))
    view.rerender(<Tree />)
    await waitFor(async () => expect((await db.pilots.get('p1'))?.name).toBe('After'))
  })
})
