import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { getFunctionName } from 'convex/server'
import type { ReactElement } from 'react'

/**
 * The one local → account surface (`AccountReconciler`).
 *
 * What these pin is behaviour a player can see or lose work to: signed out it
 * renders nothing and sends nothing; signed in, a device roster is compared
 * before it is sent; and a result that resolved with stranded rows is shown,
 * with a retry that actually retries.
 *
 * Queries are answered by name and mutations are recorded by name — see
 * `convexMock.ts` for the capture/restore discipline.
 */

import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'
import { pilotFixture } from '../../__tests__/fixtures'

let authed = false

type ClaimResult = {
  claimed: number
  skipped: number
  alreadyPresent: number
  declined: number
}
const NOTHING_CLAIMED: ClaimResult = {
  claimed: 0,
  skipped: 0,
  alreadyPresent: 0,
  declined: 0,
}
let claimResult: ClaimResult = { ...NOTHING_CLAIMED }
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
  const result: ClaimResult = { ...NOTHING_CLAIMED }
  for (const row of (args.pilots as { id: string }[] | undefined) ?? []) {
    if (s.owned.has(row.id)) {
      result.alreadyPresent += 1
    } else if (s.unparseable.has(row.id)) {
      result.skipped += 1
    } else {
      s.owned.add(row.id)
      result.claimed += 1
    }
  }
  return result
}

const convexMocks = await installConvexMocks({
  convexReact: {
    useConvexAuth: () => ({ isAuthenticated: authed, isLoading: false }),
    useMutation: (ref: unknown) => async (args: Record<string, unknown>) => {
      const name = getFunctionName(ref as never)
      mutations.push({ name, args })
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
const { _resetLegacyProbe, legacyLocalDataState, probeLegacyLocalData } = await import(
  '../../../lib/db/legacyLocalData'
)

afterAll(() => {
  convexMocks.restore()
})

/** Sign in the way a player does: after the page has settled anonymously. */
async function signIn(view: { rerender: (ui: ReactElement) => void }): Promise<void> {
  await act(async () => {
    await probeLegacyLocalData()
  })
  authed = true
  view.rerender(<Tree />)
}

/** Sign out, and let the signed-out render settle. */
async function signOut(view: { rerender: (ui: ReactElement) => void }): Promise<void> {
  authed = false
  view.rerender(<Tree />)
  await act(async () => {
    await Promise.resolve()
  })
}

function claims() {
  return mutations.filter((m) => m.name === 'claim:claimLocal')
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

beforeEach(async () => {
  authed = false
  claimResult = { ...NOTHING_CLAIMED }
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
  setQueryAnswers({
    'entities:listMine': EMPTY_ROSTER,
    'games:listMine': [],
    'entities:listWiring': EMPTY_WIRING,
  })
})

afterEach(() => {
  // Process-global; a leaked signed-in state would change what every later
  // file exercises.
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
})

describe('signed out', () => {
  test('nothing on the device: nothing is rendered', async () => {
    const { container } = render(<Tree />)
    // Let the device probe resolve before asserting it found nothing.
    await act(async () => {
      await Promise.resolve()
    })
    expect(container.textContent).toBe('')
  })

  test('rows on the device: nothing is rendered, and nothing is sent', async () => {
    // A pre-account roster stays on disk, unseen, until somebody signs in
    // (ADR-035). Signed out there is no account to send it to.
    await db.pilots.put(pilotFixture({ id: 'disk-1' }))
    const { container } = render(<Tree />)
    await act(async () => {
      await probeLegacyLocalData()
    })

    expect(legacyLocalDataState()).toBe('present')
    expect(container.textContent).toBe('')
    expect(screen.queryByRole('button')).toBeNull()
    expect(claims()).toHaveLength(0)
  })
})

describe('signed in', () => {
  test('a page loaded signed in with nothing on the device sends nothing', async () => {
    // What the store holds is the account's own rows, not local work.
    authed = true
    useEntityStore.setState({ pilots: [pilotFixture({ id: 'cached' })] })
    render(<Tree />)

    await act(async () => {
      await Promise.resolve()
    })
    expect(claims()).toHaveLength(0)
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
    await waitFor(() => expect(legacyLocalDataState()).toBe('absent'))
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  test('device rows the account already owns are not re-sent', async () => {
    await db.pilots.put(pilotFixture({ id: 'owned-1' }))
    setQueryAnswers({
      'entities:listMine': {
        ...EMPTY_ROSTER,
        pilots: [{ appId: 'owned-1', body: { id: 'owned-1' } }],
      },
      'games:listMine': [],
      'entities:listWiring': EMPTY_WIRING,
    })
    authed = true
    render(<Tree />)

    // The device pass closes the migration window once it finds nothing to send.
    await waitFor(() => expect(legacyLocalDataState()).toBe('absent'))
    expect(claims()).toHaveLength(0)
  })

  test('a resolved-but-partial move is shown, and Try again sends only what did not land', async () => {
    await db.pilots.put(pilotFixture({ id: 'disk-1' }))
    await db.pilots.put(pilotFixture({ id: 'disk-2' }))
    server = { owned: new Set(), unparseable: new Set(['disk-2']) }
    const view = render(<Tree />)
    await signIn(view)

    await waitFor(() =>
      expect(screen.getByText(/1 build could not be moved into your account/i)).toBeTruthy()
    )
    // The window stays open: the prune must not read the un-moved row as
    // "deleted elsewhere".
    expect(legacyLocalDataState()).toBe('present')

    // The account now serves what the first pass moved, as `listMine` would.
    setQueryAnswers({
      'entities:listMine': {
        ...EMPTY_ROSTER,
        pilots: [{ appId: 'disk-1', body: { id: 'disk-1' } }],
      },
      'games:listMine': [],
      'entities:listWiring': EMPTY_WIRING,
    })
    view.rerender(<Tree />)
    server.unparseable.clear()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(claims()).toHaveLength(2))
    // Resending disk-1 would come back `alreadyPresent` and never clear.
    const resent = claims()[1]?.args.pilots as { id: string }[] | undefined
    expect(resent?.map((p) => p.id)).toEqual(['disk-2'])
    await waitFor(() => expect(screen.queryByText(/could not be moved/i)).toBeNull())
    expect(legacyLocalDataState()).toBe('absent')
  })

  test('a failure from one sign-in does not stop the next one from moving the rows', async () => {
    await db.pilots.put(pilotFixture({ id: 'disk-1' }))
    server = { owned: new Set(), unparseable: new Set(['disk-1']) }
    const view = render(<Tree />)
    await signIn(view)
    await waitFor(() => expect(screen.getByText(/1 build could not be moved/i)).toBeTruthy())

    // Signing out ends that sign-in's error line…
    await signOut(view)
    expect(screen.queryByText(/could not be moved/i)).toBeNull()

    // …and the next sign-in runs its own pass rather than waiting on it.
    server.unparseable.clear()
    authed = true
    view.rerender(<Tree />)
    await waitFor(() => expect(claims()).toHaveLength(2))
    await waitFor(() => expect(legacyLocalDataState()).toBe('absent'))
    expect(screen.queryByText(/could not be moved/i)).toBeNull()
  })

  test('a remount while the move is in flight does not send it twice', async () => {
    await db.pilots.put(pilotFixture({ id: 'disk-1' }))
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

    await waitFor(() => expect(legacyLocalDataState()).toBe('absent'))
    expect(claims()).toHaveLength(1)
    expect(screen.queryByText(/could not be moved/i)).toBeNull()
  })
})
