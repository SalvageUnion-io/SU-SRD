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
const { Toaster } = await import('component-lib')
const { SalvageUnionReference } = await import('salvageunion-reference')
const { buildPilotActions } = await import('../dashboardRules')

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

describe('claim and board', () => {
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

/**
 * `crew.vitals` for the same table: Rook and Vex, where their seats put them,
 * with the server's maxima and status. `trouble` marks Vex injured.
 */
function crewAnswer(seats: ReturnType<typeof seatRow>[], trouble = false) {
  const calm = { dead: false, injured: false, ejected: false }
  const pilot = (appId: string, name: string, ownerId: string, injured: boolean) => {
    const mount = seats.find((s) => s.pilotId === appId)?.mount
    const boarded =
      mount && 'mechId' in mount && typeof mount.mechId === 'string' ? mount.mechId : null
    return {
      _id: `row-${appId.replace('seat-', '')}`,
      appId,
      linkId: appId,
      ownerId,
      ownerName: null,
      name,
      currentHP: injured ? 3 : null,
      currentAP: null,
      maxHP: 10,
      maxAP: 5,
      boarded: boarded !== null,
      mechId: boarded,
      status: { ...calm, injured },
      attention: injured,
    }
  }
  const mech = (appId: string, name: string) => ({
    _id: `row-${appId.replace('seat-', '')}`,
    appId,
    linkId: appId,
    ownerId: null,
    ownerName: null,
    name,
    currentSP: null,
    currentEP: null,
    currentHeat: null,
    maxSP: 12,
    maxEP: 6,
    maxHeat: 4,
    status: null,
    attention: false,
  })
  return {
    viewerId: 'user-me',
    pilots: [
      pilot('seat-rook', 'Rook', 'user-me', false),
      pilot('seat-vex', 'Vex', 'user-vex', trouble),
    ],
    mechs: [mech('seat-own', 'Thresher'), mech('seat-spare', 'Spare')],
  }
}

/** What the Dashboard reads of the Game: its mechs, links, seats, log, crew, Downtime and the viewer. */
function gameAnswers(seats: ReturnType<typeof seatRow>[], extra: Record<string, unknown> = {}) {
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
      pilots: [
        { _id: 'row-rook', appId: 'seat-rook', ownerId: 'user-me', body: { name: 'Rook' } },
        // A crewmate: another member's pilot, whose seat this Dashboard only reads.
        { _id: 'row-vex', appId: 'seat-vex', ownerId: 'user-vex', body: { name: 'Vex' } },
      ],
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
    'games:get': { _id: GAME_ID, name: 'Ash Flats', mediator: false },
    'changeLog:rolls': [],
    'proposals:alerts': [],
    'proposals:pending': [],
    'crew:vitals': crewAnswer(seats),
    'downtime:state': { running: false, stepIndex: null, completedBy: [], upkeepSpent: false },
    'games:members': [],
    ...extra,
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

describe("the Dashboard's display: the deck, the tabs and the table (plan layer 6)", () => {
  async function renderDashboard() {
    let view: ReturnType<typeof render> | null = null
    await act(async () => {
      view = render(
        <ConnectionContext.Provider value={connection('connected')}>
          <Dashboard pilotId="seat-rook" />
        </ConnectionContext.Provider>
      )
    })
    if (view === null) throw new Error('the Dashboard did not render')
    return view as ReturnType<typeof render>
  }

  async function openTab(name: string) {
    await act(async () => {
      screen.getByRole('tab', { name }).click()
    })
  }

  test('the rail says play is saved to the Game, and the strip carries the table', async () => {
    setQueryAnswers(
      gameAnswers([seatRow('seat-rook')], {
        'proposals:alerts': [{ _id: 'a1', message: 'Bio-Titan closing to Medium', ts: 2 }],
        'proposals:pending': [{ _id: 'p1' }],
      })
    )
    await renderDashboard()
    expect(screen.getByText('● Saved to Ash Flats')).toBeTruthy()
    expect(screen.getByText('Mediator: Bio-Titan closing to Medium')).toBeTruthy()
    const inbox = screen.getByRole('link', { name: 'Inbox · 1 proposal' })
    expect(inbox.getAttribute('href')).toBe(`/games/${GAME_ID}`)
  })

  test("the Log tab reads the Game's rolls and the Mediator's alerts", async () => {
    setQueryAnswers(
      gameAnswers([seatRow('seat-rook')], {
        'changeLog:rolls': [
          {
            _id: 'r1',
            ts: 1,
            description: 'Vex · Crush: 14, Success',
            actorName: 'Vex',
            source: 'dashboard',
          },
        ],
        'proposals:alerts': [{ _id: 'a1', message: 'Bio-Titan closing to Medium', ts: 2 }],
      })
    )
    await renderDashboard()
    await openTab('Log')
    const log = screen.getByRole('tabpanel')
    expect(within(log).getByText('Vex · Crush: 14, Success')).toBeTruthy()
    expect(within(log).getByText(/Vex · Dashboard/)).toBeTruthy()
    expect(within(log).getByText('Bio-Titan closing to Medium')).toBeTruthy()
    expect(queryCalls()).toContainEqual({
      name: 'changeLog:rolls',
      args: { gameId: GAME_ID, limit: 30 },
    })
  })

  test("a second client sees a crewmate's resolve live: the action, then the roll", async () => {
    const opened = { ref: 'x', name: 'Crush', activated: false, applied: false }
    setQueryAnswers(gameAnswers([seatRow('seat-rook'), seatRow('seat-vex', { resolving: opened })]))
    const view = await renderDashboard()
    await openTab('Crew')
    expect(screen.getByText('Vex is resolving Crush')).toBeTruthy()
    expect(screen.getByText('Rook (you)')).toBeTruthy()

    // The seat moves on, on the other client: this one's subscription answers again.
    setQueryAnswers(
      gameAnswers([
        seatRow('seat-rook'),
        seatRow('seat-vex', {
          mount: { kind: 'boarded', mechId: 'seat-spare' },
          resolving: { ...opened, activated: true, roll: { roll: 14, band: 'success' } },
        }),
      ])
    )
    await act(async () => {
      view.rerender(
        <ConnectionContext.Provider value={connection('connected')}>
          <Dashboard pilotId="seat-rook" />
        </ConnectionContext.Provider>
      )
    })
    expect(screen.getByText('Vex is resolving Crush: rolled 14, Success')).toBeTruthy()
    expect(screen.getByText('In Spare')).toBeTruthy()
  })

  test("the Crew tab reads the server's status: a ▲, the problem, and a link to the sheet", async () => {
    const seats = [seatRow('seat-rook'), seatRow('seat-vex')]
    setQueryAnswers(gameAnswers(seats))
    const view = await renderDashboard()
    expect(screen.getByRole('tab', { name: 'Crew' })).toBeTruthy()
    expect(queryCalls()).toContainEqual({ name: 'crew:vitals', args: { gameId: GAME_ID } })

    setQueryAnswers(gameAnswers(seats, { 'crew:vitals': crewAnswer(seats, true) }))
    await act(async () => {
      view.rerender(
        <ConnectionContext.Provider value={connection('connected')}>
          <Dashboard pilotId="seat-rook" />
        </ConnectionContext.Provider>
      )
    })
    await openTab('Crew needs attention')
    const crew = screen.getByRole('tabpanel')
    expect(within(crew).getByText('Injured')).toBeTruthy()
    expect(within(crew).getByText('HP 3/10 · AP 5/5')).toBeTruthy()
    const vex = within(crew).getByRole('link', { name: /Vex/ })
    expect(vex.getAttribute('href')).toBe('/sheet/pilot/seat-vex')
  })

  test('a reload mid-resolve keeps the roll, and a new roll is written to the seat', async () => {
    const ability = SalvageUnionReference.Abilities.all().find(
      (a) => a.id && (SalvageUnionReference.resolveActions(a) ?? []).some((x) => !x.hidden)
    )
    if (!ability?.id) throw new Error('no ability with an action')
    const store = useEntityStore.getState()
    const ace = pilotFixture({ id: 'seat-rook', name: 'Rook', gameId: GAME_ID })
    await store.adopt('pilot', { ...ace, abilities: [ability.id] })
    try {
      const action = buildPilotActions({ ...ace, abilities: [ability.id] })[0]
      if (!action) throw new Error('the ability has no action')
      const rolled = {
        ref: action.key,
        name: action.name,
        activated: true,
        roll: { roll: 14, band: 'success' },
        applied: false,
      }
      setQueryAnswers(gameAnswers([seatRow('seat-rook', { resolving: rolled })]))
      const { container } = await renderDashboard()

      // The Resolve tab is open, on the roll the seat kept.
      expect(screen.getByRole('tab', { name: 'Resolve' }).getAttribute('aria-selected')).toBe(
        'true'
      )
      expect(container.querySelector('.pc-deck-d20')?.textContent).toBe('14')

      await act(async () => {
        screen.getByText('Roll').click()
      })
      const write = sent.find((w) => w.name === 'seats:setResolving')
      expect(write?.args).toMatchObject({
        gameId: GAME_ID,
        pilotId: 'seat-rook',
        resolving: { ref: action.key, name: action.name, activated: true, applied: false },
      })
    } finally {
      await act(async () => {
        await store.adopt('pilot', rook)
      })
    }
  })
})
