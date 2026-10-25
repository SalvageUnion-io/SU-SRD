import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'
import { ConvexError } from 'convex/values'

/**
 * `useSeatAt` — the pilot's seat, read from `seats.forGame` and written through
 * the seat mutations (ADR-038 §2).
 *
 * Queries are answered by name (`convexMock.ts`). Mutations are recorded here
 * by name, with the optimistic update each was given, so the update can be run
 * against a stand-in for Convex's local query cache.
 */

import type { Id } from '../../../convex/_generated/dataModel'
import {
  installConvexMocks,
  queryCalls,
  setQueryAnswers,
} from '../../components/__tests__/convexMock'
import { FIXTURE_NOW, mechFixture, pilotFixture } from '../../components/__tests__/fixtures'
import type { SyncStatus } from '../../replica/sync'

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

const { useSeatAt } = await import('../useSeat')
const { SyncContext } = await import('../../replica/syncContext')
const { hydrateStores } = await import('../../components/__tests__/hydrateStores')
const { useUnits } = await import('../../replica/units')
const { resetSync } = await import('../../replica/sync')
const { ToasterMount } = await import('../../components/index')

const GAME_ID = 'g-seat'
const rook = pilotFixture({ id: 'seat-rook', name: 'Rook', gameId: GAME_ID })

function seatRow(pilotId: string, extra: Record<string, unknown> = {}) {
  return {
    pilotId,
    mount: { kind: 'foot' },
    range: 'Close',
    activeEffects: [],
    resolving: null,
    updatedAt: null,
    ...extra,
  }
}

beforeAll(async () => {
  await hydrateStores()
  resetSync()
  const store = useUnits.getState()
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
  const store = useUnits.getState()
  await store.forget('mech', 'seat-own')
  await store.forget('mech', 'seat-spare')
  await store.forget('pilot', 'seat-rook')
  convexMocks.restore()
})

beforeEach(() => {
  sent.length = 0
  updaters.clear()
  refusal = null
  refusedBy.clear()
})

function connection(status: SyncStatus) {
  return {
    status,
    canWrite: status === 'live' || status === 'signedOut',
    outdated: false,
  }
}

let handle: ReturnType<typeof useSeatAt> | null = null

function Probe() {
  handle = useSeatAt({ gameId: GAME_ID as Id<'games'>, pilotId: rook.id })
  return null
}

async function renderProbe(status: SyncStatus = 'live') {
  await act(async () => {
    render(
      <SyncContext.Provider value={connection(status)}>
        <Probe />
        <ToasterMount />
      </SyncContext.Provider>
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
    expect(seat.seat).toEqual({
      mount: { kind: 'foot' },
      range: 'Close',
      activeEffects: [],
      resolving: null,
    })
  })
})

describe('useSeat writes', () => {
  test('each write names the Game and the pilot', async () => {
    setQueryAnswers({ 'seats:forGame': [seatRow('seat-rook')] })
    const seat = await renderProbe()
    const resolving = { ref: 'k', name: 'Crush', activated: false, applied: false }
    await act(async () => {
      seat.board('seat-own')
      seat.setRange('Medium')
      seat.toggleEffect('ref-1')
      seat.dismount()
      seat.eject()
      seat.setResolving(resolving)
      seat.clearResolving()
    })
    const who = { gameId: GAME_ID, pilotId: 'seat-rook' }
    expect(sent).toEqual([
      { name: 'seats:board', args: { ...who, mechId: 'seat-own' } },
      { name: 'seats:setRange', args: { ...who, range: 'Medium' } },
      { name: 'seats:toggleEffect', args: { ...who, ref: 'ref-1' } },
      { name: 'seats:dismount', args: who },
      { name: 'seats:eject', args: who },
      { name: 'seats:setResolving', args: { ...who, resolving } },
      { name: 'seats:clearResolving', args: who },
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

    // The resolve in progress, and a change of mount ending it as the server does.
    const crush = { ref: 'k', name: 'Crush', activated: true, applied: false }
    const first = () => (cached as Array<{ resolving: unknown }>)[0]?.resolving
    updaters.get('seats:setResolving')?.(local, { ...who, resolving: crush })
    expect(first()).toEqual(crush)
    updaters.get('seats:dismount')?.(local, who)
    expect(first()).toEqual(crush)
    updaters.get('seats:board')?.(local, { ...who, mechId: 'seat-spare' })
    expect(first()).toBeNull()
    updaters.get('seats:setResolving')?.(local, { ...who, resolving: crush })
    updaters.get('seats:clearResolving')?.(local, who)
    expect(first()).toBeNull()
    expect((cached as Array<{ resolving: unknown }>)[1]?.resolving).toBeNull()
  })

  test('offline, a write is refused here and never queued', async () => {
    setQueryAnswers({ 'seats:forGame': [seatRow('seat-rook')] })
    const seat = await renderProbe('offline')
    await act(async () => {
      seat.board('seat-own')
    })
    expect(sent).toEqual([])
    expect(await screen.findByText(/that change was not saved/i)).toBeTruthy()
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

describe('assign and board', () => {
  const spare = { mechId: 'seat-spare', serverId: 'row-spare' }

  test('writes the assignment before the seat', async () => {
    setQueryAnswers({ 'seats:forGame': [seatRow('seat-rook')] })
    const seat = await renderProbe()
    await act(async () => {
      seat.assignAndBoard(spare)
    })
    expect(sent).toEqual([
      { name: 'ownership:assign', args: { table: 'mechs', entityId: 'row-spare' } },
      {
        name: 'seats:board',
        args: { gameId: GAME_ID, pilotId: 'seat-rook', mechId: 'seat-spare' },
      },
    ])
  })

  test('a refused assignment leaves the seat untouched, and says why', async () => {
    setQueryAnswers({ 'seats:forGame': [seatRow('seat-rook')] })
    refusedBy.set(
      'ownership:assign',
      new ConvexError('A crewmate already holds that — it has to be unassigned first')
    )
    const seat = await renderProbe()
    await act(async () => {
      seat.assignAndBoard(spare)
    })
    expect(sent.map((s) => s.name)).toEqual(['ownership:assign'])
    expect(await screen.findByText(/A crewmate already holds that/)).toBeTruthy()
  })

  test('offline, neither is sent', async () => {
    setQueryAnswers({ 'seats:forGame': [seatRow('seat-rook')] })
    const seat = await renderProbe('offline')
    await act(async () => {
      seat.assignAndBoard(spare)
    })
    expect(sent).toEqual([])
  })
})
