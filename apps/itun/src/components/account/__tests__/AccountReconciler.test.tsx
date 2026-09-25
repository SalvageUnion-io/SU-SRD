import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { getFunctionName } from 'convex/server'
import type { ReactElement } from 'react'

/**
 * The one local → account surface (`AccountReconciler`).
 *
 * What these pin is behaviour a player can see or lose work to: the banner
 * appears only when there is something at stake and names it; signing in sends
 * exactly this tab's work and nothing a signed-in page load did not ask for;
 * a device roster is compared before it is sent; and a result that resolved
 * with stranded rows is shown, with a retry that actually retries.
 *
 * Queries are answered by name and mutations are recorded by name — see
 * `convexMock.ts` for the capture/restore discipline.
 */

import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'
import { pilotFixture } from '../../__tests__/fixtures'

let authed = false

type ClaimResult = { claimed: number; skipped: number; alreadyPresent: number; declined: number }
let claimResult: ClaimResult = { claimed: 0, skipped: 0, alreadyPresent: 0, declined: 0 }
const mutations: { name: string; args: Record<string, unknown> }[] = []

const convexMocks = await installConvexMocks({
  authReact: true,
  convexReact: {
    useConvexAuth: () => ({ isAuthenticated: authed, isLoading: false }),
    useMutation: (ref: unknown) => async (args: Record<string, unknown>) => {
      const name = getFunctionName(ref as never)
      mutations.push({ name, args })
      if (name === 'entities:repairContainers') return { repaired: 0, skipped: 0 }
      return { ...claimResult, byKind: {} }
    },
  },
})

const { AccountReconciler } = await import('../AccountReconciler')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')
const { useEntityStore } = await import('../../../stores/entityStore')
const { setEntityBackendAuthState } = await import('../../../stores/entityBackend')
const db = await import('../../../lib/db/index')
const { _resetLegacyProbe, probeLegacyLocalData } = await import('../../../lib/db/legacyLocalData')
const { promotionState, resetPromotionStateForTesting } = await import(
  '../../../lib/account/promotionState'
)

afterAll(() => {
  convexMocks.restore()
})

/**
 * Sign in the way a player does: after the page has settled anonymously. The
 * device probe runs at boot, long before anybody finds the sign-in button, and
 * flipping before it resolves would let it read back rows the session save has
 * just cached — a race no browser can produce.
 */
async function signIn(view: { rerender: (ui: ReactElement) => void }): Promise<void> {
  await act(async () => {
    await probeLegacyLocalData()
  })
  authed = true
  view.rerender(<Tree />)
}

function claims() {
  return mutations.filter((m) => m.name === 'entities:claimLocal')
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

beforeEach(async () => {
  authed = false
  claimResult = { claimed: 0, skipped: 0, alreadyPresent: 0, declined: 0 }
  mutations.length = 0
  _resetLegacyProbe()
  db._resetDbSingleton()
  await db._clearAllStores()
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: true, mechs: true, crawlers: true, softLinks: true },
  })
  setQueryAnswers({ 'entities:listMine': EMPTY_ROSTER, 'games:listMine': [] })
})

afterEach(() => {
  // Both are process-global; a leaked signed-in state or a leaked `failed`
  // would change what every later file exercises.
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
  resetPromotionStateForTesting()
})

describe('signed out', () => {
  test('nothing built and nothing on the device: nothing is said', async () => {
    const { container } = render(<Tree />)
    // Let the device probe resolve before asserting it found nothing.
    await act(async () => {
      await Promise.resolve()
    })
    expect(container.textContent).toBe('')
  })

  test('work in this tab is named, with both ways out', async () => {
    await useEntityStore.getState().adopt('pilot', pilotFixture({ id: 'tab-1' }))
    render(<Tree />)

    expect(screen.getByText(/1 build not saved\./i)).toBeTruthy()
    expect(screen.getByText(/lives in this tab only/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Download all' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Sign in with Discord/i })).toBeTruthy()
  })

  test('a pre-account roster on the device is named in the SAME banner', async () => {
    await db.pilots.put(pilotFixture({ id: 'disk-1' }))
    await useEntityStore.getState().adopt('pilot', pilotFixture({ id: 'tab-1' }))
    render(<Tree />)

    // One banner, one download — not the two the old surfaces rendered.
    await waitFor(() => expect(screen.getByText(/This device also holds 1 build/i)).toBeTruthy())
    expect(screen.getAllByRole('button', { name: 'Download all' })).toHaveLength(1)
  })
})

describe('signing in', () => {
  test('sends this tab’s work once the backend flips, and reports nothing on success', async () => {
    await useEntityStore.getState().adopt('pilot', pilotFixture({ id: 'tab-1' }))
    claimResult = { claimed: 1, skipped: 0, alreadyPresent: 0, declined: 0 }
    const view = render(<Tree />)
    expect(claims()).toHaveLength(0)

    await signIn(view)

    await waitFor(() => expect(claims()).toHaveLength(1))
    const sent = claims()[0]?.args.pilots as { id: string }[] | undefined
    expect(sent?.map((p) => p.id)).toEqual(['tab-1'])
    await waitFor(() => expect(promotionState()).toBe('idle'))
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  test('a page loaded already signed in uploads nothing it was not asked to', async () => {
    // The consent line: only work captured WHILE ANONYMOUS in this tab is sent.
    authed = true
    await useEntityStore.getState().adopt('pilot', pilotFixture({ id: 'cached' }))
    render(<Tree />)

    await act(async () => {
      await Promise.resolve()
    })
    expect(claims()).toHaveLength(0)
  })

  test('a resolved-but-partial save is shown, and Try again retries it', async () => {
    await useEntityStore.getState().adopt('pilot', pilotFixture({ id: 'tab-1' }))
    claimResult = { claimed: 0, skipped: 1, alreadyPresent: 0, declined: 0 }
    const view = render(<Tree />)

    await signIn(view)

    await waitFor(() => expect(screen.getByText(/1 build could not be saved/i)).toBeTruthy())
    // The prune must not read the un-saved row as "deleted elsewhere".
    expect(promotionState()).toBe('failed')

    claimResult = { claimed: 1, skipped: 0, alreadyPresent: 0, declined: 0 }
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(claims()).toHaveLength(2))
    await waitFor(() => expect(screen.queryByText(/could not be saved/i)).toBeNull())
  })

  test('device rows missing from the account are sent, on the shelf', async () => {
    await db.pilots.put(pilotFixture({ id: 'disk-1', gameId: 'phantom-workspace' }))
    authed = true
    render(<Tree />)

    await waitFor(() => expect(claims()).toHaveLength(1))
    const sent = claims()[0]?.args.pilots as { id: string; gameId: unknown }[]
    expect(sent.map((p) => p.id)).toEqual(['disk-1'])
    // A phantom Game id would upload the row into the same invisibility.
    expect(sent[0]?.gameId).toBeNull()
  })

  test('device rows the account already owns are not re-sent', async () => {
    await db.pilots.put(pilotFixture({ id: 'owned-1' }))
    setQueryAnswers({
      'entities:listMine': {
        ...EMPTY_ROSTER,
        pilots: [{ appId: 'owned-1', body: { id: 'owned-1' } }],
      },
      'games:listMine': [],
    })
    authed = true
    render(<Tree />)

    await waitFor(() =>
      expect(mutations.some((m) => m.name === 'entities:repairContainers')).toBe(true)
    )
    expect(claims()).toHaveLength(0)
  })
})
