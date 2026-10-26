import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'

/**
 * `useSeatAt` — the pilot's seat, read from its Game room's `seats` record and
 * written as acts on that room (ADR-038 §2).
 *
 * The room is a fake (`fakeRooms.ts`): its records are served by hand, and
 * every act is recorded here by name, beside the one Games call
 * (`ownership.assign`), so their order shows.
 */

import { ConvexError } from 'convex/values'
import { installConvexMocks } from '../../components/__tests__/convexMock'
import { FIXTURE_NOW, mechFixture, pilotFixture } from '../../components/__tests__/fixtures'
import { answerActs, closeRooms, openRooms, serve } from '../../replica/__tests__/fakeRooms'
import type { SyncStatus } from '../../replica/sync'

type Sent = { name: string; args: Record<string, unknown> }

const sent: Sent[] = []
/** Refusals by name: an act's room refuses it, a Games call throws. */
const refusedBy = new Map<string, string>()

function useMutationMock(ref: unknown) {
  const name = getFunctionName(ref as FunctionReference<'mutation'>).replace(':', '.')
  return async (args: Record<string, unknown>) => {
    sent.push({ name, args })
    const refusal = refusedBy.get(name)
    if (refusal !== undefined) throw new ConvexError(refusal)
  }
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
    ejected: false,
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
  refusedBy.clear()
  openRooms(GAME_ID)
  answerActs((act) => {
    sent.push({ name: act.name, args: act.args })
    const refusal = refusedBy.get(act.name)
    if (refusal !== undefined) throw new Error(refusal)
  })
})

afterEach(() => closeRooms())

function connection(status: SyncStatus) {
  return {
    status,
    canWrite: status === 'live' || status === 'signedOut',
    outdated: false,
  }
}

let handle: ReturnType<typeof useSeatAt> | null = null

function Probe() {
  handle = useSeatAt({ gameId: GAME_ID, pilotId: rook.id })
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
    serve(GAME_ID, {
      seats: [
        seatRow('someone-else', { range: 'Far' }),
        seatRow('seat-rook', { range: 'Long', activeEffects: ['x'] }),
      ],
    })
    const seat = await renderProbe()
    expect(seat.seat.range).toBe('Long')
    expect(seat.seat.activeEffects).toEqual(['x'])
  })

  test('before the room’s snapshot the seat reads as on foot, at Close', async () => {
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
  test('each write is an act on the Game’s room, naming the pilot', async () => {
    serve(GAME_ID, { seats: [seatRow('seat-rook')] })
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
    const who = { pilotId: 'seat-rook' }
    expect(sent).toEqual([
      { name: 'seats.board', args: { ...who, mechId: 'seat-own' } },
      { name: 'seats.setRange', args: { ...who, range: 'Medium' } },
      { name: 'seats.toggleEffect', args: { ...who, ref: 'ref-1' } },
      { name: 'seats.dismount', args: who },
      { name: 'seats.eject', args: who },
      { name: 'seats.setResolving', args: { ...who, resolving } },
      { name: 'seats.clearResolving', args: who },
    ])
  })

  test('offline, a write is refused here and never queued', async () => {
    serve(GAME_ID, { seats: [seatRow('seat-rook')] })
    const seat = await renderProbe('offline')
    await act(async () => {
      seat.board('seat-own')
    })
    expect(sent).toEqual([])
    // Sonner's toast store is module-wide, so an earlier file in the same
    // process may have left the same words up: at least one is enough.
    expect((await screen.findAllByText(/that change was not saved/i)).length).toBeGreaterThan(0)
  })

  test("a refused write shows the server's reason", async () => {
    serve(GAME_ID, { seats: [seatRow('seat-rook')] })
    refusedBy.set('seats.board', 'Another pilot is already aboard that mech')
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
    serve(GAME_ID, { seats: [seatRow('seat-rook')] })
    const seat = await renderProbe()
    await act(async () => {
      seat.assignAndBoard(spare)
    })
    expect(sent).toEqual([
      { name: 'ownership.assign', args: { gameId: GAME_ID, entityId: 'row-spare' } },
      { name: 'seats.board', args: { pilotId: 'seat-rook', mechId: 'seat-spare' } },
    ])
  })

  test('a refused assignment leaves the seat untouched, and says why', async () => {
    serve(GAME_ID, { seats: [seatRow('seat-rook')] })
    refusedBy.set(
      'ownership.assign',
      'A crewmate already holds that — it has to be unassigned first'
    )
    const seat = await renderProbe()
    await act(async () => {
      seat.assignAndBoard(spare)
    })
    expect(sent.map((s) => s.name)).toEqual(['ownership.assign'])
    expect(await screen.findByText(/A crewmate already holds that/)).toBeTruthy()
  })

  test('offline, neither is sent', async () => {
    serve(GAME_ID, { seats: [seatRow('seat-rook')] })
    const seat = await renderProbe('offline')
    await act(async () => {
      seat.assignAndBoard(spare)
    })
    expect(sent).toEqual([])
  })
})
