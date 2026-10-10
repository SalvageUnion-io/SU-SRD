import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

/**
 * `GameHub` — a Game's own page (board M2, issue 1278): the band, the roster,
 * then two columns of sections. What this file defends:
 *
 *  - every member gets Crew & seats, Downtime, their answer queue and The
 *    Game; only the Organizer gets the admin (invite links, the knocks, Hand
 *    over, ending the game) — the server refuses the rest
 *  - only the Mediator gets the band's door to the Mediator Dashboard and
 *    Proposals you sent; the instruments themselves live on that dashboard
 *  - `games.get` answering `null` reads as an explanation with a way back to
 *    Shelves, and still loading is not the same as not a member
 *
 * And the one way into the Dashboard (ADR-038 §1): Launch Dashboard at the top
 * of the hub, for players and the Mediator alike, only while the Game has a
 * Mediator, asking only which pilot — yours pre-selected when you have one —
 * and offering only pilots this browser holds, since those are all the gate
 * can open. That last is checked end to end: each offered pilot is handed to
 * the real `DashboardGate`, with the Dashboard itself stubbed.
 *
 * Queries are answered **by name** (`getFunctionName`) — see `convexMock.ts`.
 */

import { getFunctionName } from 'convex/server'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import type { QueryAnswers } from '../../__tests__/convexMock'
import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'
import { pilotFixture } from '../../__tests__/fixtures'

const mutations: { name: string; args: unknown }[] = []
/** Every `router.navigate(opts)` the hub made. */
const navigations: unknown[] = []

// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs. See `convexMock.ts` for the capture/restore rules.
const convexMocks = await installConvexMocks({
  convexReact: {
    useMutation: (ref: unknown) => async (args: unknown) => {
      mutations.push({ name: getFunctionName(ref as never), args })
    },
  },
  // A router that records where Launch Dashboard goes. `useRouter` answers, so
  // `AppLink` renders this `Link`: a plain anchor carrying its props.
  also: {
    '@tanstack/react-router': () => ({
      Link: ({ children, to, ...rest }: { children: ReactNode; to: string }) =>
        createElement('a', { href: to, ...rest }, children),
      useNavigate: () => async (opts: unknown) => {
        navigations.push(opts)
      },
      useRouter: () => ({
        navigate: async (opts: unknown) => {
          navigations.push(opts)
        },
      }),
    }),
    // Relative to `convexMock.ts`, not this file. Whether the gate opens it,
    // and for which pilot, is all the launch tests need of the Dashboard.
    '../dashboard/Dashboard': () => ({
      Dashboard: ({ pilotId }: { pilotId: string }) =>
        createElement('p', null, `Dashboard for ${pilotId}`),
    }),
  },
})

const { GameHub } = await import('../GameHub')
const { DashboardGate } = await import('../../dashboard/DashboardGate')
const { ConnectionContext } = await import('../../../lib/connection/connectionContext')
const { hydrateStores } = await import('../../__tests__/hydrateStores')
const { useEntityStore } = await import('../../../stores/entityStore')
const { setEntityBackendAuthState } = await import('../../../stores/entityBackend')
const { setActiveContainer } = await import('../../../stores/activeContainerStore')

beforeAll(hydrateStores)

beforeEach(() => {
  mutations.length = 0
  navigations.length = 0
  setActiveContainer({ kind: 'game', gameId: 'g1' })
})

afterAll(() => {
  setActiveContainer({ kind: 'shelf' })
  convexMocks.restore()
})

const GAME = {
  _id: 'g1',
  name: 'Union Crawler #430',
  templateOrigin: undefined,
  mediator: false,
  organizer: false,
  tableRunner: false,
  memberCount: 2,
  crawlerName: 'Hamlet',
  pilotCount: 4,
  mechCount: 3,
}

/** Everything below `games.get`, for a viewer whose role the test sets. */
function answers(over: QueryAnswers = {}): QueryAnswers {
  return {
    'games:get': GAME,
    'account:me': { _id: 'u1', displayName: 'Ash' },
    'games:members': [
      { userId: 'u1', displayName: 'Ash', mediator: false, organizer: false, joinedAt: 1 },
      { userId: 'u2', displayName: 'Beefcake', mediator: false, organizer: false, joinedAt: 2 },
    ],
    'entities:listForGame': { pilots: [], mechs: [], crawlers: [], softLinks: [] },
    'proposals:pending': [],
    'downtime:state': { running: false, stepIndex: null, completedBy: [], upkeepSpent: false },
    'mediator:amMediator': false,
    'invites:list': [],
    'invites:pendingRequests': [],
    'proposals:sent': [],
    ...over,
  }
}

// Async act: the roster inside flips its hydrated flag from a promise after mount.
async function renderHub(over: QueryAnswers = {}): Promise<void> {
  setQueryAnswers(answers(over))
  await act(async () => {
    render(<GameHub gameId="g1" activeSegment="pilot" onSegmentChange={() => {}} />)
  })
}

const heading = (name: string) => screen.queryByRole('heading', { level: 2, name })

describe('the sections under the roster (board M2)', () => {
  test('every member gets Crew & seats, Downtime, the answer queue and The Game, below the lists', async () => {
    await renderHub({
      'proposals:pending': [
        { _id: 'c1', entityType: 'pilot', field: 'currentHP', after: 3, reason: null },
      ],
    })

    for (const name of ['Crew & seats', 'Downtime', 'Awaiting your answer', 'The Game']) {
      expect(heading(name)).toBeTruthy()
    }
    // Below the lists: the roster's columns come first in the document.
    const pilots = screen.getByRole('heading', { level: 2, name: 'Pilots' })
    const crew = screen.getByRole('heading', { level: 2, name: 'Crew & seats' })
    expect(pilots.compareDocumentPosition(crew) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('a plain member gets none of the Organizer’s admin, and can still invite', async () => {
    await renderHub()

    // The server refuses a non-Organizer's invites.list and setMediator
    // outright, so offering either would be a control that only ever errors.
    expect(heading('Invite links')).toBeNull()
    expect(heading('Asking to join')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Make link' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Hand over|Appoint/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete this game' })).toBeNull()
    // …but any member can bring someone to the table (issue 1255).
    // (The button itself is `CopyInviteLink`'s, mounted only when Connected.)
    expect(heading('Invite a crewmate')).toBeTruthy()
    expect(screen.getByText(/asks to join, and the organizer lets them in/)).toBeTruthy()
  })

  test('the Organizer gets invite links, the knocks, who mediates, and ending the game', async () => {
    await renderHub({ 'games:get': { ...GAME, organizer: true } })

    expect(heading('Invite links')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Make link' })).toBeTruthy()
    expect(heading('Asking to join')).toBeTruthy()
    // Nobody mediates yet, so the Organizer appoints — themselves or anyone.
    // This is the ONLY way the Mediator flag is ever set.
    expect(screen.getByText('Nobody yet')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Appoint' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete this game' })).toBeTruthy()
  })

  test('Hand over appoints the chosen member first, then stands the old Mediator down', async () => {
    await renderHub({
      'games:get': { ...GAME, organizer: true, mediator: true },
      'games:members': [
        { userId: 'u1', displayName: 'Ash', mediator: true, organizer: true, joinedAt: 1 },
        { userId: 'u2', displayName: 'Beefcake', mediator: false, organizer: false, joinedAt: 2 },
      ],
    })
    expect(screen.getAllByText('Ash (you)').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Hand over' }))
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByRole('option', { name: 'Beefcake' })).toBeTruthy()
    expect(mutations).toHaveLength(0)

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Hand over' }))
    })
    expect(mutations).toEqual([
      { name: 'games:setMediator', args: { gameId: 'g1', userId: 'u2', mediator: true } },
      { name: 'games:setMediator', args: { gameId: 'g1', userId: 'u1', mediator: false } },
    ])
  })

  test('ending the game asks first, says where everything lands, and then shows Shelves', async () => {
    await renderHub({ 'games:get': { ...GAME, organizer: true } })

    fireEvent.click(screen.getByRole('button', { name: 'Delete this game' }))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('It cannot be undone')
    expect(dialog.textContent).toContain('4 pilots and 3 mechs go back to whoever owns them')
    expect(dialog.textContent).toContain(
      'Hamlet and anything unclaimed come to you, in your shelves'
    )
    expect(mutations).toHaveLength(0)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete game' }))
    })
    expect(mutations).toEqual([{ name: 'games:destroy', args: { gameId: 'g1' } }])
    expect(navigations).toEqual([{ to: '/' }])
  })

  test('a game with no crawler does not promise one', async () => {
    await renderHub({ 'games:get': { ...GAME, organizer: true, crawlerName: null, pilotCount: 0 } })
    fireEvent.click(screen.getByRole('button', { name: 'Delete this game' }))

    expect(screen.getByText(/^Anything unclaimed comes to you, in your shelves\.$/)).toBeTruthy()
    // With no pilots there is no "0 pilots" line to read past.
    expect(screen.queryByText(/0 pilots/)).toBeNull()
  })
})

describe('Crew & seats', () => {
  test('each member’s pilot with what they have, the open seats, and the count', async () => {
    await renderHub({
      'games:members': [
        { userId: 'u1', displayName: 'Ash', mediator: true, organizer: true, joinedAt: 1 },
        { userId: 'u2', displayName: 'Beefcake', mediator: false, organizer: false, joinedAt: 2 },
      ],
      'entities:listForGame': {
        pilots: [
          { _id: 'p1', appId: 'a-p1', ownerId: 'u2', body: { id: 'a-p1', callsign: 'Pickle' } },
          { _id: 'p2', appId: 'a-p2', ownerId: null, body: { id: 'a-p2', callsign: 'Hotdog' } },
        ],
        mechs: [
          { _id: 'm1', appId: 'a-m1', ownerId: 'u2', body: { id: 'a-m1', name: 'Spectrum' } },
        ],
        crawlers: [],
        softLinks: [
          { type: 'mech-to-pilot', from: { id: 'a-m1' }, to: { id: 'a-p1' }, gameId: 'g1' },
        ],
      },
    })

    const seats = within(screen.getByRole('list', { name: 'Seats' }))
    const rows = seats.getAllByRole('listitem').map((li) => li.textContent)
    // Join order; a Mediator with no pilot runs the table; an unclaimed pilot is an open seat.
    expect(rows).toEqual([
      'MediatorAsh (you)Runs the table',
      'PlayerBeefcakePickle · Spectrum',
      'Open—Hotdog · waiting for a player',
    ])
    expect(screen.getByText('1 of 2 seats')).toBeTruthy()
    // No presence column: nothing writes it, and a false "Here" is worse than none.
    expect(screen.queryByText(/^(Here|Away)$/)).toBeNull()
  })
})

describe('the Mediator on the Game page', () => {
  test('a player, or an Organizer who does not mediate, gets no Mediator door', async () => {
    await renderHub({ 'games:get': { ...GAME, organizer: true } })
    expect(screen.queryByText('You mediate')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Open the Mediator dashboard' })).toBeNull()
    expect(heading('Proposals you sent')).toBeNull()
  })

  test('the Mediator gets the band’s door to the dashboard and the proposals they sent', async () => {
    await renderHub({
      'games:get': { ...GAME, mediator: true },
      'proposals:sent': [
        {
          _id: 'c1',
          entityId: 'p1',
          entityType: 'pilot',
          targetName: 'Judge',
          field: 'currentHP',
          after: 4,
          reason: 'Ejection burn',
          state: 'proposed',
          ts: Date.now(),
          mine: true,
          actorName: null,
        },
      ],
    })

    expect(screen.getByText('You mediate')).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Open the Mediator dashboard' }).getAttribute('href')
    ).toBe('/mediator/g1')
    expect(heading('Proposals you sent')).toBeTruthy()
    expect(screen.getByText('Judge · HP → 4 · “Ejection burn”')).toBeTruthy()
    expect(screen.getByText('Pending')).toBeTruthy()
    // The instruments live on the Mediator Dashboard now, not on this page.
    expect(screen.queryByRole('button', { name: 'Propose' })).toBeNull()
  })
})

describe('a game the viewer is not in', () => {
  test('explains itself, and offers the way back to Shelves, instead of rendering the table', async () => {
    await renderHub({ 'games:get': null })

    expect(screen.getByText(/not in this game/i)).toBeTruthy()
    expect(screen.getByText(/invite link/i)).toBeTruthy()
    expect(heading('Crew & seats')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Back to your shelves' }))
    expect(navigations).toEqual([{ to: '/' }])
  })

  test('still loading is not the same as not a member', async () => {
    await renderHub({ 'games:get': undefined })

    expect(screen.getByText(/Loading this game/i)).toBeTruthy()
    expect(screen.queryByText(/not in this game/i)).toBeNull()
  })
})

describe('Launch Dashboard', () => {
  /** A Game whose Mediator is Beefcake; the viewer, Ash, plays. */
  const MEDIATED = [
    { userId: 'u1', displayName: 'Ash', mediator: false, organizer: false },
    { userId: 'u2', displayName: 'Beefcake', mediator: true, organizer: true },
  ]
  /** The same table with Ash in the Mediator's chair instead. */
  const ASH_MEDIATES = [
    { userId: 'u1', displayName: 'Ash', mediator: true, organizer: true },
    { userId: 'u2', displayName: 'Beefcake', mediator: false, organizer: false },
  ]
  /** Beefcake's: listed, but never in Ash's browser. */
  const THEIRS = {
    _id: 'p-theirs',
    appId: 'a-theirs',
    ownerId: 'u2',
    body: { id: 'a-theirs', name: 'Roach-Boy' },
  }
  /** Unclaimed, and held here: the browser that made it keeps its copy. */
  const PREGEN = {
    _id: 'p-pregen',
    appId: 'hub-pregen',
    ownerId: null,
    body: { id: 'hub-pregen', name: 'Pre-gen' },
  }
  // Listed crewmate-first, so "yours first" is the picker's doing.
  const PILOTS = [
    THEIRS,
    { _id: 'p-mine', appId: 'hub-mine', ownerId: 'u1', body: { id: 'hub-mine', name: 'Vex Arlo' } },
    {
      _id: 'p-mine-2',
      appId: 'hub-mine-2',
      ownerId: 'u1',
      body: { id: 'hub-mine-2', name: 'Mira' },
    },
  ]
  /** The Game's pilots this browser holds. */
  const HELD = [
    ['hub-mine', 'Vex Arlo'],
    ['hub-mine-2', 'Mira'],
    ['hub-pregen', 'Pre-gen'],
  ] as const
  const listing = (pilots: unknown[]) => ({ pilots, mechs: [], crawlers: [], softLinks: [] })

  beforeAll(async () => {
    // Filling the cache only: `adopt` is not a user write, so it needs no account.
    setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
    const store = useEntityStore.getState()
    for (const [id, name] of HELD) {
      await store.adopt('pilot', pilotFixture({ id, name, gameId: 'g1' }))
    }
  })

  afterAll(async () => {
    // Leave the shared store as this file found it.
    const store = useEntityStore.getState()
    for (const [id] of HELD) await store.forget('pilot', id)
  })

  const launcher = () => screen.queryByRole('button', { name: 'Launch Dashboard' })

  async function openPicker(): Promise<HTMLElement> {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Launch Dashboard' }))
    })
    return screen.getByRole('dialog')
  }

  /** The pilots on offer, as their labels read: name, then whose. */
  const offered = (dialog: HTMLElement) =>
    within(dialog)
      .queryAllByRole('radio')
      .map((r) => r.closest('label')?.textContent)

  /** The body of `/dashboard/<id>`, signed in and connected. */
  async function openGate(id: string): Promise<void> {
    const connected = {
      mode: 'connected' as const,
      canWrite: true,
      showDisconnectedWarning: false,
      settling: false,
    }
    await act(async () => {
      render(
        <ConnectionContext.Provider value={connected}>
          <DashboardGate id={id} />
        </ConnectionContext.Provider>
      )
    })
  }

  test('a player gets it at the top of the hub, above the roster', async () => {
    await renderHub({ 'games:members': MEDIATED })

    const button = launcher()
    expect(button).toBeTruthy()
    const pilots = screen.getByRole('heading', { level: 2, name: 'Pilots' })
    expect(
      (button as HTMLElement).compareDocumentPosition(pilots) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  test('so does the Mediator', async () => {
    await renderHub({
      'games:get': { ...GAME, mediator: true, organizer: true },
      'games:members': ASH_MEDIATES,
      'mediator:amMediator': true,
    })
    expect(launcher()).toBeTruthy()
  })

  test('a Game with no Mediator has nothing to launch, and says so', async () => {
    await renderHub()
    expect(launcher()).toBeNull()
    expect(screen.getByText('The Dashboard opens once this Game has a Mediator.')).toBeTruthy()
  })

  test('nothing shows while the crew is still loading', async () => {
    await renderHub({ 'games:members': undefined })
    expect(launcher()).toBeNull()
    expect(screen.queryByText(/opens once this Game has a Mediator/)).toBeNull()
  })

  test('asks only for the pilot, yours first, with your first one chosen; Launch opens it', async () => {
    await renderHub({ 'games:members': MEDIATED, 'entities:listForGame': listing(PILOTS) })
    const dialog = await openPicker()

    // The pilot is the only choice on offer, and a crewmate's is not one.
    const radios = within(dialog).getAllByRole('radio') as HTMLInputElement[]
    expect(within(dialog).queryAllByRole('combobox')).toHaveLength(0)
    expect(offered(dialog)).toEqual(['Vex ArloYou', 'MiraYou'])
    expect(radios.map((r) => r.checked)).toEqual([true, false])

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Launch' }))
    })
    expect(navigations).toEqual([{ to: '/dashboard/$pilotId', params: { pilotId: 'hub-mine' } }])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('opened before the pilots answer, it says so, then chooses yours when they arrive', async () => {
    setQueryAnswers(answers({ 'games:members': MEDIATED, 'entities:listForGame': undefined }))
    let view: ReturnType<typeof render> | undefined
    await act(async () => {
      view = render(<GameHub gameId="g1" activeSegment="pilot" onSegmentChange={() => {}} />)
    })
    const dialog = await openPicker()
    expect(within(dialog).getByText('Loading pilots…')).toBeTruthy()
    expect(within(dialog).queryByText(/saved in this browser/)).toBeNull()

    setQueryAnswers(answers({ 'games:members': MEDIATED, 'entities:listForGame': listing(PILOTS) }))
    await act(async () => {
      view?.rerender(<GameHub gameId="g1" activeSegment="pilot" onSegmentChange={() => {}} />)
    })
    const radios = within(screen.getByRole('dialog')).getAllByRole('radio') as HTMLInputElement[]
    expect(radios.map((r) => r.checked)).toEqual([true, false])
  })

  test('a viewer who owns no pilot gets no pre-selection, and picks one', async () => {
    await renderHub({
      'games:get': { ...GAME, mediator: true, organizer: true },
      'games:members': ASH_MEDIATES,
      'mediator:amMediator': true,
      'entities:listForGame': listing([THEIRS, PREGEN]),
    })
    const dialog = await openPicker()

    // Beefcake's pilot is not in this browser, so the gate could not open it.
    expect(offered(dialog)).toHaveLength(1)
    const radio = within(dialog).getByRole('radio', { name: /Pre-gen/ }) as HTMLInputElement
    expect(radio.checked).toBe(false)
    const launch = within(dialog).getByRole('button', { name: 'Launch' })
    expect(launch.hasAttribute('disabled')).toBe(true)

    fireEvent.click(radio)
    expect(launch.hasAttribute('disabled')).toBe(false)
    await act(async () => {
      fireEvent.click(launch)
    })
    expect(navigations).toEqual([{ to: '/dashboard/$pilotId', params: { pilotId: 'hub-pregen' } }])
  })

  test('a viewer who holds none of the Game’s pilots is told so, and offered nothing', async () => {
    await renderHub({
      'games:get': { ...GAME, mediator: true, organizer: true },
      'games:members': ASH_MEDIATES,
      'mediator:amMediator': true,
      'entities:listForGame': listing([THEIRS]),
    })
    const dialog = await openPicker()

    expect(offered(dialog)).toEqual([])
    expect(
      within(dialog).getByText(/None of this Game's pilots is saved in this browser/)
    ).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Launch' }).hasAttribute('disabled')).toBe(
      true
    )
  })

  test('every pilot it offers opens the Dashboard at the gate, not "Pilot not found"', async () => {
    await renderHub({
      'games:members': MEDIATED,
      'entities:listForGame': listing([...PILOTS, PREGEN]),
    })
    let dialog = await openPicker()
    const count = within(dialog).getAllByRole('radio').length
    const ids: string[] = []
    for (let i = 0; i < count; i++) {
      fireEvent.click(within(dialog).getAllByRole('radio')[i] as HTMLElement)
      navigations.length = 0
      await act(async () => {
        fireEvent.click(within(dialog).getByRole('button', { name: 'Launch' }))
      })
      ids.push((navigations[0] as { params: { pilotId: string } }).params.pilotId)
      dialog = await openPicker()
    }
    expect(ids).toEqual(['hub-mine', 'hub-mine-2', 'hub-pregen'])

    for (const id of ids) {
      await openGate(id)
      expect(screen.getByText(`Dashboard for ${id}`)).toBeTruthy()
    }
    expect(screen.queryByRole('heading', { name: 'Pilot not found' })).toBeNull()

    // The one it leaves out is exactly the one the gate would refuse.
    await openGate('a-theirs')
    expect(screen.getByRole('heading', { name: 'Pilot not found' })).toBeTruthy()
  })

  test('the dialog takes focus, and Escape closes it without launching', async () => {
    await renderHub({ 'games:members': MEDIATED, 'entities:listForGame': listing(PILOTS) })
    const dialog = await openPicker()

    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    await act(async () => {
      fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(navigations).toHaveLength(0)
  })
})
