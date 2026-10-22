import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, render, waitFor } from '@testing-library/react'
import { getFunctionName } from 'convex/server'
import type { ReactElement } from 'react'

/**
 * The stores follow the signed-in account (`AccountReconciler`).
 *
 * What these pin is behaviour a player can see or lose work to: signed out it
 * renders nothing; signed in, the stores follow the server — and nothing they
 * hold is ever sent up; when the session ends, this tab lets go of its rows.
 *
 * Queries are answered by name and mutations are recorded by name — see
 * `convexMock.ts` for the capture/restore discipline.
 */

import { installConvexMocks, setQueryAnswers } from '../../../components/__tests__/convexMock'
import { pilotFixture } from '../../../components/__tests__/fixtures'

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
const { resetStores } = await import('../../../stores/__tests__/resetStores')

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
  npcs: [],
  mechPatterns: [],
  encounterNpcs: [],
}

/** `ShelfSync` also mounts `WiringSync`, which reads assignments and Game crawlers. */
const EMPTY_WIRING = { gameIds: [], softLinks: [], crawlers: [] }

/** The answers every signed-in render needs: an empty account. */
function answers(over: Record<string, unknown> = {}) {
  return {
    'entities:listMine': EMPTY_ROSTER,
    'entities:listWiring': EMPTY_WIRING,
    ...over,
  }
}

beforeEach(() => {
  authed = false
  mutations.length = 0
  resetStores()
  setQueryAnswers(answers())
})

afterEach(() => {
  // Process-global; a leaked signed-in state would change what every later
  // file exercises.
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
})

describe('signed out', () => {
  test('nothing is rendered, and nothing is sent', async () => {
    useEntityStore.setState({ pilots: [pilotFixture({ id: 'held-1' })] })
    const { container } = render(<Tree />)
    await act(async () => {
      await Promise.resolve()
    })

    expect(container.textContent).toBe('')
    expect(mutations).toEqual([])
  })
})

describe('signed in, the stores follow the account', () => {
  test('a build deleted on another device leaves this tab', async () => {
    useEntityStore.setState({ pilots: [pilotFixture({ id: 'p1' })] })
    authed = true
    render(<Tree />)

    await waitFor(() => expect(useEntityStore.getState().pilots).toEqual([]))
    expect(mutations).toEqual([])
  })

  test('a sign-out in another tab drops the rows this tab loaded', async () => {
    // There is no tab-to-tab channel: this tab sees only its own session end,
    // and lets go of what it holds, so the next account never sees it.
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
    expect(useEntityStore.getState().hydrated.pilots).toBe(true)
  })

  test('a newer version of a held build is adopted, though no id changed', async () => {
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
    await waitFor(() => expect(useEntityStore.getState().get('pilot', 'p1')?.name).toBe('Before'))

    // Edited on another device: same id, newer row.
    setQueryAnswers(served('After', 2))
    view.rerender(<Tree />)
    await waitFor(() => expect(useEntityStore.getState().get('pilot', 'p1')?.name).toBe('After'))
  })
})
