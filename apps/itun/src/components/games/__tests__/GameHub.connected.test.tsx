import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

/**
 * `GameHub` — what the hub at `/` shows below "Showing" when a Game is picked:
 * the roster, then the **Game** section, then the **Mediator** section.
 *
 * It replaced three pages (the Games list, the Game page, the Mediator page),
 * so this file carries what their tests defended:
 *
 *  - every member gets the Game section; only the Organizer gets its admin
 *    (invites, who mediates, ending the game) — the server refuses the rest
 *  - only the Mediator gets the Mediator section, and gets all of it; the
 *    propose form offers only entities somebody can answer for
 *  - `games.get` answering `null` reads as an explanation with a way back to
 *    My Stuff, and still loading is not the same as not a member
 *
 * And the one way into the Dashboard (ADR-038 §1): Launch Dashboard at the top
 * of the hub, for players and the Mediator alike, only while the Game has a
 * Mediator, asking only which pilot — yours pre-selected when you have one.
 *
 * Queries are answered **by name** (`getFunctionName`) — see `convexMock.ts`.
 */

import { getFunctionName } from 'convex/server'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import type { QueryAnswers } from '../../__tests__/convexMock'
import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'

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
  },
})

const { GameHub } = await import('../GameHub')
const { hydrateStores } = await import('../../__tests__/hydrateStores')
const { getActiveContainer, setActiveContainer } = await import(
  '../../../stores/activeContainerStore'
)

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

const CLAIMED_PILOT = {
  _id: 'p1',
  appId: null,
  ownerId: 'u2',
  ownerName: 'Beefcake',
  name: 'Roach-Boy',
  currentHP: 8,
  currentAP: 4,
}

const UNCLAIMED_PILOT = {
  _id: 'p2',
  appId: null,
  ownerId: null,
  ownerName: null,
  name: 'Pre-gen',
  currentHP: 10,
  currentAP: 5,
}

/** Everything below `games.get`, for a viewer whose role the test sets. */
function answers(over: QueryAnswers = {}): QueryAnswers {
  return {
    'games:get': GAME,
    'account:me': { _id: 'u1', displayName: 'Ash' },
    'games:members': [
      { userId: 'u1', displayName: 'Ash', mediator: false, organizer: false },
      { userId: 'u2', displayName: 'Beefcake', mediator: false, organizer: false },
    ],
    'entities:listForGame': { pilots: [], mechs: [], crawlers: [], softLinks: [] },
    'proposals:pending': [],
    'downtime:state': { running: false, stepIndex: null, completedBy: [], upkeepSpent: false },
    'mediator:amMediator': false,
    'invites:list': [],
    'invites:pendingRequests': [],
    'crew:vitals': { viewerId: 'u1', pilots: [], mechs: [] },
    'proposals:alerts': [],
    'mediator:npcs': [],
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

const section = (name: string) => screen.queryByRole('region', { name })

describe('the Game section', () => {
  test('every member gets it, below the roster: the answer queue and Downtime', async () => {
    await renderHub({
      'proposals:pending': [{ _id: 'c1', entityType: 'pilot', field: 'currentHP', after: 3 }],
    })

    expect(section('Game')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: 'Awaiting your answer' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: 'Downtime' })).toBeTruthy()

    // Below the lists: the roster's columns come first in the document.
    const pilots = screen.getByRole('heading', { level: 2, name: 'Pilots' })
    const game = screen.getByRole('heading', { level: 2, name: 'Game' })
    expect(pilots.compareDocumentPosition(game) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('a plain member gets none of the Organizer’s admin', async () => {
    await renderHub()

    // The server refuses a non-Organizer's invites.list and setMediator
    // outright, so offering either would be a control that only ever errors.
    expect(screen.queryByText('Create invite code')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Who mediates' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'End this game' })).toBeNull()
  })

  test('the Organizer gets invites, who mediates, and ending the game', async () => {
    await renderHub({ 'games:get': { ...GAME, organizer: true } })

    expect(screen.getByRole('heading', { level: 3, name: 'Invite someone' })).toBeTruthy()
    expect(screen.getByText('Create invite code')).toBeTruthy()
    expect(screen.getByLabelText('Invite note')).toBeTruthy()
    // One per member — the Organizer can appoint themselves OR somebody else.
    // This panel is the ONLY way the Mediator flag is ever set: without it the
    // Mediator section strands for the person who made the Game.
    expect(screen.getByRole('heading', { level: 3, name: 'Who mediates' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Make Mediator' })).toHaveLength(2)
    expect(screen.getByRole('heading', { level: 3, name: 'End this game' })).toBeTruthy()
  })

  test('ending the game asks first, says where everything lands, and then shows My Stuff', async () => {
    await renderHub({ 'games:get': { ...GAME, organizer: true } })

    fireEvent.click(screen.getByRole('button', { name: 'Delete this game' }))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('It cannot be undone')
    expect(dialog.textContent).toContain('4 pilots and 3 mechs go back to whoever owns them')
    expect(dialog.textContent).toContain('Hamlet and anything unclaimed come to you, in My Stuff')
    expect(mutations).toHaveLength(0)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete game' }))
    })
    expect(mutations).toEqual([{ name: 'games:destroy', args: { gameId: 'g1' } }])
    expect(getActiveContainer()).toEqual({ kind: 'shelf' })
  })

  test('a game with no crawler does not promise one', async () => {
    await renderHub({ 'games:get': { ...GAME, organizer: true, crawlerName: null, pilotCount: 0 } })
    fireEvent.click(screen.getByRole('button', { name: 'Delete this game' }))

    expect(screen.getByText(/^Anything unclaimed comes to you, in My Stuff\.$/)).toBeTruthy()
    // With no pilots there is no "0 pilots" line to read past.
    expect(screen.queryByText(/0 pilots/)).toBeNull()
  })
})

describe('the Mediator section', () => {
  test('a player, or an Organizer who does not mediate, gets none of it', async () => {
    await renderHub({ 'games:get': { ...GAME, organizer: true } })

    expect(section('Mediator')).toBeNull()
    // The refusal is total: a visible propose form the server would reject is
    // worse than no form, and the opposition tray is private.
    expect(screen.queryByLabelText('Proposal target')).toBeNull()
    expect(screen.queryByLabelText('Alert message')).toBeNull()
    expect(screen.queryByLabelText('NPC name')).toBeNull()
  })

  test('while the role is still unknown it shows nothing rather than guessing', async () => {
    await renderHub({ 'mediator:amMediator': undefined })
    expect(section('Mediator')).toBeNull()
  })

  test('the Mediator gets every instrument, after the Game section', async () => {
    await renderHub({
      'games:get': { ...GAME, mediator: true },
      'mediator:amMediator': true,
      'crew:vitals': { viewerId: 'u1', pilots: [CLAIMED_PILOT], mechs: [] },
    })

    expect(section('Mediator')).toBeTruthy()
    for (const name of ['Vitals', 'Propose a change', 'Tell the table', 'Opposition']) {
      expect(screen.getByRole('heading', { level: 3, name })).toBeTruthy()
    }
    const game = screen.getByRole('heading', { level: 2, name: 'Game' })
    const mediator = screen.getByRole('heading', { level: 2, name: 'Mediator' })
    expect(game.compareDocumentPosition(mediator) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('only claimed entities are offered as proposal targets', async () => {
    await renderHub({
      'mediator:amMediator': true,
      'crew:vitals': {
        viewerId: 'u1',
        pilots: [CLAIMED_PILOT, UNCLAIMED_PILOT],
        mechs: [{ ...CLAIMED_PILOT, _id: 'm1', name: 'Iron Mongrel' }],
      },
    })

    // An unclaimed pre-gen has nobody to answer the proposal.
    expect(screen.getByRole('option', { name: 'Roach-Boy (pilot)' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Iron Mongrel (mech)' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Pre-gen (pilot)' })).toBeNull()
    // Asking, not setting — and nothing to send without a target and value.
    expect(screen.getByText(/You are asking, not setting/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Propose' }).hasAttribute('disabled')).toBe(true)
  })

  test('alerts are shown back, and the tray is private and names the unnamed', async () => {
    await renderHub({
      'mediator:amMediator': true,
      'proposals:alerts': [{ _id: 'a1', message: 'The crawler is taking fire.' }],
      'mediator:npcs': [
        { _id: 'n1', body: {} },
        { _id: 'n2', body: { name: 'Scrap Hound' } },
      ],
    })

    expect(screen.getByText('The crawler is taking fire.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText(/Only you can see this/i)).toBeTruthy()
    expect(screen.getByText('Unnamed')).toBeTruthy()
    expect(screen.getByText('Scrap Hound')).toBeTruthy()
  })
})

describe('a game the viewer is not in', () => {
  test('explains itself, and offers My Stuff, instead of rendering the table', async () => {
    await renderHub({ 'games:get': null })

    expect(screen.getByText(/not in this game/i)).toBeTruthy()
    expect(section('Game')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show My Stuff' }))
    expect(getActiveContainer()).toEqual({ kind: 'shelf' })
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
  // Listed crewmate-first, so "yours first" is the picker's doing.
  const PILOTS = [
    {
      _id: 'p-theirs',
      appId: 'a-theirs',
      ownerId: 'u2',
      body: { id: 'a-theirs', name: 'Roach-Boy' },
    },
    { _id: 'p-mine', appId: 'a-mine', ownerId: 'u1', body: { id: 'a-mine', name: 'Vex Arlo' } },
    { _id: 'p-mine-2', appId: 'a-mine-2', ownerId: 'u1', body: { id: 'a-mine-2', name: 'Mira' } },
  ]
  const listing = (pilots: unknown[]) => ({ pilots, mechs: [], crawlers: [], softLinks: [] })

  const launcher = () => screen.queryByRole('button', { name: 'Launch Dashboard' })

  async function openPicker(): Promise<HTMLElement> {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Launch Dashboard' }))
    })
    return screen.getByRole('dialog')
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

    // The pilot is the only choice on offer.
    const radios = within(dialog).getAllByRole('radio') as HTMLInputElement[]
    expect(within(dialog).queryAllByRole('combobox')).toHaveLength(0)
    expect(radios.map((r) => r.closest('label')?.textContent)).toEqual([
      'Vex ArloYou',
      'MiraYou',
      'Roach-BoyBeefcake',
    ])
    expect(radios.map((r) => r.checked)).toEqual([true, false, false])

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Launch' }))
    })
    expect(navigations).toEqual([{ to: '/dashboard/$pilotId', params: { pilotId: 'a-mine' } }])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('a viewer who owns no pilot gets no pre-selection, and picks one', async () => {
    await renderHub({
      'games:get': { ...GAME, mediator: true, organizer: true },
      'games:members': ASH_MEDIATES,
      'mediator:amMediator': true,
      'entities:listForGame': listing([PILOTS[0]]),
    })
    const dialog = await openPicker()

    const radio = within(dialog).getByRole('radio', { name: /Roach-Boy/ }) as HTMLInputElement
    expect(radio.checked).toBe(false)
    const launch = within(dialog).getByRole('button', { name: 'Launch' })
    expect(launch.hasAttribute('disabled')).toBe(true)

    fireEvent.click(radio)
    expect(launch.hasAttribute('disabled')).toBe(false)
    await act(async () => {
      fireEvent.click(launch)
    })
    // A crewmate's pilot opens as the gate allows; the server refuses writes.
    expect(navigations).toEqual([{ to: '/dashboard/$pilotId', params: { pilotId: 'a-theirs' } }])
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
