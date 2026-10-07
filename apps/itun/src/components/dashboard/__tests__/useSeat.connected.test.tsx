import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, render, screen, within } from '@testing-library/react'
import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'
import { ConvexError } from 'convex/values'

/**
 * `useSeat` — the pilot's seat, read from `seats.forGame` and written through
 * the seat mutations (ADR-038 §2), and the Dashboard reading mount from it.
 *
 * Queries are answered by name (`convexMock.ts`). Mutations are recorded here
 * by name, with the optimistic update each was given, so the update can be run
 * against a stand-in for Convex's local query cache.
 */

import type { ConnectionMode } from '../../../lib/connection/connectionMode'
import { installConvexMocks, queryCalls, setQueryAnswers } from '../../__tests__/convexMock'
import { FIXTURE_NOW, mechFixture, pilotFixture } from '../../__tests__/fixtures'

type Sent = { name: string; args: Record<string, unknown> }
type Updater = (store: LocalStore, args: Record<string, unknown>) => void
type LocalStore = {
  getQuery: (ref: unknown, args: unknown) => unknown
  setQuery: (ref: unknown, args: unknown, value: unknown) => void
}

const sent: Sent[] = []
const updaters = new Map<string, Updater>()
let refusal: unknown = null
/** Refusals for one mutation only, by name. */
const refusedBy = new Map<string, unknown>()

function useMutationMock(ref: unknown) {
  const name = getFunctionName(ref as FunctionReference<'mutation'>)
  const send = async (args: Record<string, unknown>) => {
    sent.push({ name, args })
    if (refusal !== null) throw refusal
    if (refusedBy.has(name)) throw refusedBy.get(name)
  }
  return Object.assign(send, {
    withOptimisticUpdate: (update: Updater) => {
      updaters.set(name, update)
      return send
    },
  })
}

// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs. See `convexMock.ts`.
const convexMocks = await installConvexMocks({ convexReact: { useMutation: useMutationMock } })

const { useSeat } = await import('../useSeat')
const { Dashboard } = await import('../Dashboard')
const { ConnectionContext } = await import('../../../lib/connection/connectionContext')
const { hydrateStores } = await import('../../__tests__/hydrateStores')
const { useEntityStore } = await import('../../../stores/entityStore')
const { setEntityBackendAuthState } = await import('../../../stores/entityBackend')
const { usePlayStateStore } = await import('../../../stores/playStateStore')
const { Toaster } = await import('component-lib')

const GAME_ID = 'g-seat'
const rook = pilotFixture({ id: 'seat-rook', name: 'Rook', gameId: GAME_ID })

function seatRow(pilotId: string, extra: Record<string, unknown> = {}) {
  return {
    pilotId,
    mount: { kind: 'foot' },
    range: 'Close',
    activeEffects: [],
    updatedAt: null,
    ...extra,
  }
}

beforeAll(async () => {
  await hydrateStores()
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
  const store = useEntityStore.getState()
  await store.adopt('pilot', rook)
  await store.adopt('mech', mechFixture({ id: 'seat-own', name: 'Thresher', gameId: GAME_ID }))
  await store.adopt('mech', mechFixture({ id: 'seat-spare', name: 'Spare', gameId: GAME_ID }))
  await store.adopt('softLink', {
    id: 'seat-link',
    type: 'mech-to-pilot',
    from: { type: 'mech', id: 'seat-own' },
    to: { type: 'pilot', id: 'seat-rook' },
    createdAt: FIXTURE_NOW,
  })
})

afterAll(async () => {
  const store = useEntityStore.getState()
  await store.forget('mech', 'seat-own')
  await store.forget('mech', 'seat-spare')
  await store.forget('pilot', 'seat-rook')
  convexMocks.restore()
})

beforeEach(() => {
  // Another file may have left this device in Downtime.
  usePlayStateStore.setState({ downtime: false })
  sent.length = 0
  updaters.clear()
  refusal = null
  refusedBy.clear()
})

function connection(mode: ConnectionMode) {
  return {
    mode,
    canWrite: mode === 'connected' || mode === 'solo',
    showDisconnectedWarning: mode === 'disconnected',
    settling: mode === 'connecting',
  }
}

let handle: ReturnType<typeof useSeat> | null = null

function Probe() {
  handle = useSeat(rook)
  return null
}

async function renderProbe(mode: ConnectionMode = 'connected') {
  await act(async () => {
    render(
      <ConnectionContext.Provider value={connection(mode)}>
        <Probe />
        <Toaster />
      </ConnectionContext.Provider>
    )
  })
  if (handle === null) throw new Error('the probe did not render')
  return handle
}

describe('useSeat reads', () => {
  test("the pilot's seat comes from its Game's forGame answer", async () => {
    setQueryAnswers({
      'seats:forGame': [
        seatRow('someone-else', { range: 'Far' }),
        seatRow('seat-rook', { range: 'Long', activeEffects: ['x'] }),
      ],
    })
    const seat = await renderProbe()
    expect(seat.seat.range).toBe('Long')
    expect(seat.seat.activeEffects).toEqual(['x'])
    expect(queryCalls()).toEqual([{ name: 'seats:forGame', args: { gameId: GAME_ID } }])
  })

  test('before the answer arrives the seat reads as on foot, at Close', async () => {
    setQueryAnswers({ 'seats:forGame': undefined })
    const seat = await renderProbe()
    expect(seat.seat).toEqual({ mount: { kind: 'foot' }, range: 'Close', activeEffects: [] })
  })
})

describe('useSeat writes', () => {
  test('each write names the Game and the pilot', async () => {
    setQueryAnswers({ 'seats:forGame': [seatRow('seat-rook')] })
    const seat = await renderProbe()
    await act(async () => {
      seat.board('seat-own')
      seat.setRange('Medium')
      seat.toggleEffect('ref-1')
      seat.dismount()
      seat.eject()
    })
    const who = { gameId: GAME_ID, pilotId: 'seat-rook' }
    expect(sent).toEqual([
      { name: 'seats:board', args: { ...who, mechId: 'seat-own' } },
      { name: 'seats:setRange', args: { ...who, range: 'Medium' } },
      { name: 'seats:toggleEffect', args: { ...who, ref: 'ref-1' } },
      { name: 'seats:dismount', args: who },
      { name: 'seats:eject', args: who },
    ])
  })

  test('the optimistic updates change only that pilot, at once', async () => {
    setQueryAnswers({ 'seats:forGame': [seatRow('seat-rook')] })
    await renderProbe()

    let cached: unknown = [seatRow('seat-rook'), seatRow('crewmate')]
    const local: LocalStore = {
      getQuery: () => cached,
      setQuery: (_ref, _args, value) => {
        cached = value
      },
    }
    const who = { gameId: GAME_ID, pilotId: 'seat-rook' }
    updaters.get('seats:board')?.(local, { ...who, mechId: 'seat-spare' })
    updaters.get('seats:setRange')?.(local, { ...who, range: 'Far' })
    updaters.get('seats:toggleEffect')?.(local, { ...who, ref: 'a' })
    updaters.get('seats:toggleEffect')?.(local, { ...who, ref: 'b' })
    updaters.get('seats:toggleEffect')?.(local, { ...who, ref: 'a' })
    expect(cached).toEqual([
      seatRow('seat-rook', {
        mount: { kind: 'boarded', mechId: 'seat-spare' },
        range: 'Far',
        activeEffects: ['b'],
      }),
      seatRow('crewmate'),
    ])

    updaters.get('seats:eject')?.(local, who)
    expect((cached as Array<{ mount: unknown }>)[0]?.mount).toEqual({ kind: 'foot' })
    updaters.get('seats:board')?.(local, { ...who, mechId: 'seat-spare' })
    updaters.get('seats:dismount')?.(local, who)
    expect((cached as Array<{ mount: unknown }>)[0]?.mount).toEqual({ kind: 'foot' })
  })

  test('offline, a write is refused here and never queued', async () => {
    setQueryAnswers({ 'seats:forGame': [seatRow('seat-rook')] })
    const seat = await renderProbe('disconnected')
    await act(async () => {
      seat.board('seat-own')
    })
    expect(sent).toEqual([])
    expect(await screen.findByText(/read-only until the connection returns/i)).toBeTruthy()
  })

  test("a refused write shows the server's reason", async () => {
    setQueryAnswers({ 'seats:forGame': [seatRow('seat-rook')] })
    refusal = new ConvexError('Another pilot is already aboard that mech')
    const seat = await renderProbe()
    await act(async () => {
      seat.board('seat-own')
    })
    expect(await screen.findByText('Another pilot is already aboard that mech')).toBeTruthy()
  })
})

describe('claim and board (plan §8 A4)', () => {
  const spare = { mechId: 'seat-spare', serverId: 'row-spare' }

  test('writes the claim before the seat', async () => {
    setQueryAnswers({ 'seats:forGame': [seatRow('seat-rook')] })
    const seat = await renderProbe()
    await act(async () => {
      seat.claimAndBoard(spare)
    })
    expect(sent).toEqual([
      { name: 'ownership:claim', args: { table: 'mechs', entityId: 'row-spare' } },
      {
        name: 'seats:board',
        args: { gameId: GAME_ID, pilotId: 'seat-rook', mechId: 'seat-spare' },
      },
    ])
  })

  test('a refused claim leaves the seat untouched, and says why', async () => {
    setQueryAnswers({ 'seats:forGame': [seatRow('seat-rook')] })
    refusedBy.set(
      'ownership:claim',
      new ConvexError('A crewmate already holds that — it has to be released first')
    )
    const seat = await renderProbe()
    await act(async () => {
      seat.claimAndBoard(spare)
    })
    expect(sent.map((s) => s.name)).toEqual(['ownership:claim'])
    expect(await screen.findByText(/A crewmate already holds that/)).toBeTruthy()
  })

  test('offline, neither is sent', async () => {
    setQueryAnswers({ 'seats:forGame': [seatRow('seat-rook')] })
    const seat = await renderProbe('disconnected')
    await act(async () => {
      seat.claimAndBoard(spare)
    })
    expect(sent).toEqual([])
  })
})

/** What the Board menu reads: the Game's mechs, links and the viewer. */
function gameAnswers(seats: unknown[]) {
  const mech = (appId: string, name: string, ownerId: string | null) => ({
    _id: `row-${appId.replace('seat-', '')}`,
    appId,
    ownerId,
    body: { id: appId, name },
  })
  const toHen = (from: string) => ({
    type: 'mech-to-crawler',
    from: { type: 'mech', id: from },
    to: { type: 'crawler', id: 'hen' },
  })
  return {
    'seats:forGame': seats,
    'account:me': { _id: 'user-me', displayName: 'Me', avatarUrl: null, email: null },
    'entities:listForGame': {
      pilots: [{ _id: 'row-rook', appId: 'seat-rook', ownerId: 'user-me', body: { name: 'Rook' } }],
      mechs: [mech('seat-own', 'Thresher', 'user-me'), mech('seat-spare', 'Spare', null)],
      crawlers: [],
      softLinks: [
        {
          type: 'pilot-to-crawler',
          from: { type: 'pilot', id: 'seat-rook' },
          to: { type: 'crawler', id: 'hen' },
        },
        toHen('seat-own'),
        toHen('seat-spare'),
      ],
      primaryCrawlerId: null,
    },
  }
}

describe('the Dashboard reads mount from the seat', () => {
  async function renderDashboard() {
    await act(async () => {
      render(
        <ConnectionContext.Provider value={connection('connected')}>
          <Dashboard pilotId="seat-rook" />
        </ConnectionContext.Provider>
      )
    })
  }

  test('on foot: the pilot runs it', async () => {
    setQueryAnswers(gameAnswers([seatRow('seat-rook')]))
    await renderDashboard()
    expect(screen.getByText('Pilot · Rook')).toBeTruthy()
    expect(screen.getByText('On Foot')).toBeTruthy()
  })

  test('boarded: the mech the seat names, not the assigned one', async () => {
    setQueryAnswers(
      gameAnswers([seatRow('seat-rook', { mount: { kind: 'boarded', mechId: 'seat-spare' } })])
    )
    await renderDashboard()
    expect(screen.getByText('Mech · Spare')).toBeTruthy()
    expect(screen.getByText('Boarded')).toBeTruthy()
  })

  test('Board on foot boards the assigned mech', async () => {
    setQueryAnswers(gameAnswers([seatRow('seat-rook')]))
    await renderDashboard()
    await act(async () => {
      screen.getByText('▶ Board Thresher').click()
    })
    expect(sent).toEqual([
      { name: 'seats:board', args: { gameId: GAME_ID, pilotId: 'seat-rook', mechId: 'seat-own' } },
    ])
  })

  test("the Board menu lists the crawler's spare, and claims it before boarding", async () => {
    setQueryAnswers(gameAnswers([seatRow('seat-rook')]))
    await renderDashboard()
    await act(async () => {
      screen.getByRole('button', { name: 'Choose a mech to board' }).click()
    })
    await act(async () => {
      screen.getByRole('button', { name: 'Claim and board Spare' }).click()
    })
    // The confirm step sends nothing.
    expect(sent).toEqual([])
    const confirm = screen.getByRole('dialog', { name: 'Claim and board' })
    await act(async () => {
      within(confirm).getByRole('button', { name: 'Claim and board Spare' }).click()
    })
    expect(sent).toEqual([
      { name: 'ownership:claim', args: { table: 'mechs', entityId: 'row-spare' } },
      {
        name: 'seats:board',
        args: { gameId: GAME_ID, pilotId: 'seat-rook', mechId: 'seat-spare' },
      },
    ])
  })
})
