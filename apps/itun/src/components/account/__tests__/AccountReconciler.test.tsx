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
/**
 * When set, `claimLocal` answers the way the server does instead of returning
 * `claimResult`: an id it already holds is `alreadyPresent` (`appIdTaken`
 * matches the caller's own rows too), an id in `unparseable` is `skipped`, and
 * anything else is claimed and remembered. A retry test against a canned result
 * passes for a resend the server would reject.
 */
let server: { owned: Set<string>; unparseable: Set<string> } | null = null
/** Holds `claimLocal` open until released, to overlap a call with a remount. */
let gate: Promise<void> | null = null
const mutations: { name: string; args: Record<string, unknown> }[] = []

function serverClaim(args: Record<string, unknown>, s: NonNullable<typeof server>): ClaimResult {
  const result: ClaimResult = { claimed: 0, skipped: 0, alreadyPresent: 0, declined: 0 }
  for (const row of (args.pilots as { id: string }[] | undefined) ?? []) {
    if (s.owned.has(row.id)) result.alreadyPresent += 1
    else if (s.unparseable.has(row.id)) result.skipped += 1
    else {
      s.owned.add(row.id)
      result.claimed += 1
    }
  }
  return result
}

const convexMocks = await installConvexMocks({
  authReact: true,
  convexReact: {
    useConvexAuth: () => ({ isAuthenticated: authed, isLoading: false }),
    useMutation: (ref: unknown) => async (args: Record<string, unknown>) => {
      const name = getFunctionName(ref as never)
      mutations.push({ name, args })
      if (name === 'entities:repairContainers') return { repaired: 0, skipped: 0 }
      if (gate !== null) await gate
      const result = server === null ? claimResult : serverClaim(args, server)
      return { ...result, byKind: {} }
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
  server = null
  gate = null
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

  test('the device rows are not called pre-account builds', async () => {
    // The probe reports `present` for ANY non-empty store — a returning
    // player's own account cache included — so the copy may not claim more.
    await db.pilots.put(pilotFixture({ id: 'disk-1' }))
    const { container } = render(<Tree />)

    await waitFor(() => expect(screen.getByText(/This device holds 1 build\./i)).toBeTruthy())
    expect(container.textContent).not.toMatch(/before accounts/i)
    expect(container.textContent).toMatch(/bring anything missing into your account/i)
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

  test('a resolved-but-partial save is shown, and Try again sends only what did not land', async () => {
    await useEntityStore.getState().adopt('pilot', pilotFixture({ id: 'tab-1' }))
    await useEntityStore.getState().adopt('pilot', pilotFixture({ id: 'tab-2' }))
    server = { owned: new Set(), unparseable: new Set(['tab-2']) }
    const view = render(<Tree />)

    await signIn(view)

    await waitFor(() => expect(screen.getByText(/1 build could not be saved/i)).toBeTruthy())
    // The prune must not read the un-saved row as "deleted elsewhere".
    expect(promotionState()).toBe('failed')

    // The account now serves what the first pass saved, as `listMine` would.
    setQueryAnswers({
      'entities:listMine': { ...EMPTY_ROSTER, pilots: [{ appId: 'tab-1', body: { id: 'tab-1' } }] },
      'games:listMine': [],
    })
    view.rerender(<Tree />)
    server.unparseable.clear()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(claims()).toHaveLength(2))
    // Resending tab-1 would come back `alreadyPresent` and never clear.
    const resent = claims()[1]?.args.pilots as { id: string }[] | undefined
    expect(resent?.map((p) => p.id)).toEqual(['tab-2'])
    await waitFor(() => expect(screen.queryByText(/could not be saved/i)).toBeNull())
    expect(promotionState()).toBe('idle')
  })

  test('a retry that fails again reports only the rows still missing', async () => {
    await useEntityStore.getState().adopt('pilot', pilotFixture({ id: 'tab-1' }))
    await useEntityStore.getState().adopt('pilot', pilotFixture({ id: 'tab-2' }))
    server = { owned: new Set(), unparseable: new Set(['tab-2']) }
    const view = render(<Tree />)
    await signIn(view)
    await waitFor(() => expect(screen.getByText(/1 build could not be saved/i)).toBeTruthy())

    setQueryAnswers({
      'entities:listMine': { ...EMPTY_ROSTER, pilots: [{ appId: 'tab-1', body: { id: 'tab-1' } }] },
      'games:listMine': [],
    })
    view.rerender(<Tree />)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(claims()).toHaveLength(2))
    await waitFor(() => expect(screen.getByText(/1 build could not be saved/i)).toBeTruthy())
    expect(screen.queryByText(/2 builds could not be saved/i)).toBeNull()
  })

  test('a remount while the upload is in flight does not send it twice', async () => {
    await useEntityStore.getState().adopt('pilot', pilotFixture({ id: 'tab-1' }))
    server = { owned: new Set(), unparseable: new Set() }
    let release: () => void = () => {}
    gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const view = render(<Tree />)
    await signIn(view)
    await waitFor(() => expect(claims()).toHaveLength(1))

    // Connectivity drops mid-upload (the signed-in half unmounts on `blocked`)
    // and comes back while Convex still has the first call queued.
    await act(async () => {
      window.dispatchEvent(new Event('offline'))
    })
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    await act(async () => {
      release()
      await gate
    })

    await waitFor(() => expect(promotionState()).toBe('idle'))
    expect(claims()).toHaveLength(1)
    expect(screen.queryByText(/could not be saved/i)).toBeNull()
  })

  test('a failure from one sign-in does not stop the next one from saving', async () => {
    await useEntityStore.getState().adopt('pilot', pilotFixture({ id: 'tab-1' }))
    server = { owned: new Set(), unparseable: new Set(['tab-1']) }
    const view = render(<Tree />)
    await signIn(view)
    await waitFor(() => expect(screen.getByText(/1 build could not be saved/i)).toBeTruthy())

    // Sign out, build something else, sign in again (the server now accepts both).
    authed = false
    view.rerender(<Tree />)
    await waitFor(() => expect(promotionState()).toBe('idle'))
    server.unparseable.clear()
    await act(async () => {
      await useEntityStore.getState().adopt('pilot', pilotFixture({ id: 'tab-2' }))
    })
    authed = true
    view.rerender(<Tree />)

    // The new sign-in runs its own pass rather than waiting on the old error.
    await waitFor(() => expect(claims()).toHaveLength(2))
    const sent = claims()[1]?.args.pilots as { id: string }[] | undefined
    expect(sent?.map((p) => p.id)).toContain('tab-2')
    await waitFor(() => expect(promotionState()).toBe('idle'))
    expect(screen.queryByText(/could not be saved/i)).toBeNull()
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
