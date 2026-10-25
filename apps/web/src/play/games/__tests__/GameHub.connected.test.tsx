import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

/**
 * `GameHub` — a Game's own page in Play, `/play/games/$gameId` (ADR-052 §5):
 * the band, the roster, then two columns of sections. What this
 * file defends:
 *
 *  - it is a Manage page under Play's band, with none of Build's controls
 *    (Import, Export, the Games select) and no container of its own
 *
 *  - every member gets their answer queue and The
 *    Game; only the Organizer gets the admin (the invite link, Hand over,
 *    ending the game) — the server refuses the rest
 *  - only the Mediator's Mediate opens Play's Mediator screen, and only they
 *    get Proposals you sent; the instruments themselves live in Play
 *  - `games.get` answering `null` reads as an explanation with a way back to
 *    Shelves, and still loading is not the same as not a member
 *
 * And a player's way into Play: Play in the band, always there, with or
 * without a Mediator (ADR-051 §4), asking only which pilot — yours
 * pre-selected when you have one — and offering only pilots this browser
 * holds, since those are all the gate can open. That last is checked end to
 * end: each offered pilot is handed to the real `PlayGate`, with the Cockpit
 * itself stubbed.
 *
 * Queries are answered **by name** (`getFunctionName`) — see `convexMock.ts`.
 */

import { getFunctionName } from 'convex/server'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import type { QueryAnswers } from '../../../components/__tests__/convexMock'
import { installConvexMocks, setQueryAnswers } from '../../../components/__tests__/convexMock'
import { pilotFixture } from '../../../components/__tests__/fixtures'

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
  // A router that records where Play goes. `useRouter` answers, so
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
    // and for which pilot, is all the launch tests need of the Cockpit.
    '../../play/PlayCockpit': () => ({
      PlayCockpit: ({ target }: { target: { pilotId: string } }) =>
        createElement('p', null, `Play for ${target.pilotId}`),
    }),
  },
})

const { GameHub } = await import('../GameHub')
const { PlayGate } = await import('../../../play/PlayGate')
const { SyncContext } = await import('../../../replica/syncContext')
const { hydrateStores } = await import('../../../components/__tests__/hydrateStores')
const { useUnits } = await import('../../../replica/units')
const { resetSync } = await import('../../../replica/sync')
const { CHAPTER_BAND_COLOR } = await import('../../../components/index')

/** A colour as the DOM reads it back off an inline style. */
function colorOf(value: string): string {
  const probe = document.createElement('div')
  probe.style.backgroundColor = value
  return probe.style.backgroundColor
}

beforeAll(hydrateStores)

beforeEach(() => {
  mutations.length = 0
  navigations.length = 0
})

afterAll(() => {
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
    'crew:vitals': undefined,
    'proposals:pending': [],
    'downtime:state': { running: false, stepIndex: null, completedBy: [], upkeepSpent: false },
    'mediator:amMediator': false,
    'proposals:sent': [],
    // A column's "Move in…" checks its moves against your Games.
    'games:listMine': [],
    ...over,
  }
}

/** The Game section's ⋯ (`More for The Game`), where Delete this Game lives. */
async function openGameMenu(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'More for The Game' }))
  })
}

// Async act: the roster inside flips its hydrated flag from a promise after mount.
async function renderHub(over: QueryAnswers = {}): Promise<void> {
  setQueryAnswers(answers(over))
  await act(async () => {
    render(<GameHub gameId="g1" />)
  })
}

const heading = (name: string) => screen.queryByRole('heading', { level: 2, name })

/** An element's text as drawn: a bodyless Compact's +MORE is hidden until a chip does not fit (C5). */
const drawnText = (el: Element) => {
  const copy = el.cloneNode(true) as Element
  for (const hidden of copy.querySelectorAll('[hidden]')) hidden.remove()
  return copy.textContent
}
describe('a Manage page in Play (ADR-052 §5, §7)', () => {
  test('the Game’s name on Play’s band, and none of Build’s controls', async () => {
    await renderHub()
    const title = screen.getByRole('heading', { level: 1, name: 'Union Crawler #430' })
    const band = title.closest('.su-chapter-band') as HTMLElement
    expect(band.style.backgroundColor).toBe(colorOf(CHAPTER_BAND_COLOR.play))
    expect(screen.queryByLabelText('Games')).toBeNull()
    expect(screen.queryByRole('button', { name: /Import/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Export/ })).toBeNull()
  })

  test('the sections are Slabs (solid stamps), level 2 under the page’s h1', async () => {
    await renderHub({ 'games:get': { ...GAME, organizer: true } })
    for (const name of ['Crew', 'Invite link', 'The Game']) {
      expect(heading(name)).toBeTruthy()
    }
  })
})

describe('the sections under the roster', () => {
  test('every member gets the answer queue and The Game, below the lists; no Crew & seats', async () => {
    await renderHub({
      'proposals:pending': [
        { _id: 'c1', entityType: 'pilot', field: 'currentHP', after: 3, reason: null },
      ],
    })

    for (const name of ['Awaiting your answer', 'The Game']) {
      expect(heading(name)).toBeTruthy()
    }
    // Its seats ride the pilots' rows.
    expect(heading('Crew & seats')).toBeNull()
    // Downtime runs in Play, not on the Game page.
    expect(heading('Downtime')).toBeNull()
    // The crew comes first in the document.
    const pilots = screen.getByRole('heading', { level: 2, name: 'Crew' })
    const game = screen.getByRole('heading', { level: 2, name: 'The Game' })
    expect(pilots.compareDocumentPosition(game) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('a plain member gets none of the Organizer’s admin', async () => {
    await renderHub()

    // The server refuses a non-Organizer's invites.link and setMediator
    // outright, so offering either would be a control that only ever errors.
    expect(heading('Invite link')).toBeNull()
    expect(screen.queryByRole('button', { name: /Hand over|Appoint/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'More for The Game' })).toBeNull()
  })

  test('the Organizer gets the invite link, who mediates, and ending the game', async () => {
    await renderHub({ 'games:get': { ...GAME, organizer: true } })

    // The buttons are `CopyInviteLink`'s and `ResetInviteLink`'s, mounted only when Connected.
    expect(heading('Invite link')).toBeTruthy()
    // Its buttons alone: no copy explaining them.
    expect(screen.queryByText(/joins as a player/)).toBeNull()
    // Nobody mediates yet, so the Organizer appoints — themselves or anyone.
    // This is the ONLY way the Mediator flag is ever set.
    expect(screen.getByText('Nobody yet')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Appoint' })).toBeTruthy()
    await openGameMenu()
    expect(screen.getByRole('menuitem', { name: 'Delete this Game…' })).toBeTruthy()
    // Each member is a social card: their name, their roles as chips.
    const members = screen.getByRole('list', { name: 'Members' })
    expect(within(members).getByText('Ash (you)')).toBeTruthy()
    expect(within(members).getByText('Beefcake')).toBeTruthy()
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

  test('ending the game asks first, says where everything lands, and then shows your Games', async () => {
    await renderHub({ 'games:get': { ...GAME, organizer: true } })

    await openGameMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete this Game…' }))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('It cannot be undone')
    expect(dialog.textContent).toContain('4 pilots and 3 mechs go back to whoever owns them')
    expect(dialog.textContent).toContain(
      'Hamlet and anything unassigned come to you, in your Training Bay'
    )
    expect(mutations).toHaveLength(0)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete Game' }))
    })
    expect(mutations).toEqual([{ name: 'games:destroy', args: { gameId: 'g1' } }])
    expect(navigations).toEqual([{ to: '/play' }])
  })

  test('a game with no crawler does not promise one', async () => {
    await renderHub({ 'games:get': { ...GAME, organizer: true, crawlerName: null, pilotCount: 0 } })
    await openGameMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete this Game…' }))

    expect(
      screen.getByText(/^Anything unassigned comes to you, in your Training Bay\.$/)
    ).toBeTruthy()
    // With no pilots there is no "0 pilots" line to read past.
    expect(screen.queryByText(/0 pilots/)).toBeNull()
  })
})

describe('the seats, on the Pilots rows', () => {
  test('each pilot carries its HP and mech, and the Pilots head counts the seats', async () => {
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
      // The server's derived maxima; an absent current HP is full.
      'crew:vitals': {
        viewerId: 'u1',
        mechs: [],
        pilots: [
          { _id: 'p1', currentHP: 4, maxHP: 10 },
          { _id: 'p2', currentHP: null, maxHP: 8 },
        ],
      },
    })

    const pilots = screen.getByRole('region', { name: 'Crew' })
    const text = drawnText(pilots)
    // A pilot's row: its HP, then its mech as its header-only Mini, never a
    // chip.
    expect(text).toContain('HP4/10')
    expect(text).not.toContain('MechSpectrum')
    expect(pilots.querySelector('[data-entity-linked]')?.textContent).toContain('Spectrum')
    expect(text).toContain('HP8/8')
    // The count is the label-first chip, `SEATS | 1/2`.
    expect(within(pilots).getByText('Seats').closest('.su-stat-cell')?.textContent).toBe('Seats1/2')
    // No presence column: nothing writes it, and a false "Here" is worse than none.
    expect(screen.queryByText(/^(Here|Away)$/)).toBeNull()
  })
})

describe('the Mediator on the Game page', () => {
  test('a player, or an Organizer who does not mediate, gets no Mediator door', async () => {
    await renderHub({ 'games:get': { ...GAME, organizer: true } })
    expect(screen.queryByText('You mediate')).toBeNull()
    // Their way in is the player's Play button, not the Mediator's link.
    expect(screen.queryByRole('link', { name: 'Mediate' })).toBeNull()
    expect(heading('Proposals you sent')).toBeNull()
  })

  test('the Mediator gets the band’s door to Play and the proposals they sent', async () => {
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
    expect(screen.getByRole('link', { name: 'Mediate' }).getAttribute('href')).toBe(
      '/play/games/g1/mediate'
    )
    expect(heading('Proposals you sent')).toBeTruthy()
    expect(screen.getByText('Judge · HP → 4 · “Ejection burn”')).toBeTruthy()
    expect(screen.getByText('Pending')).toBeTruthy()
    // The instruments live in Play, not on this page.
    expect(screen.queryByRole('button', { name: 'Propose' })).toBeNull()
  })
})

describe('a game the viewer is not in', () => {
  test('explains itself, and offers the way back to your Games, instead of rendering the table', async () => {
    await renderHub({ 'games:get': null })

    expect(screen.getByText(/not in this Game/i)).toBeTruthy()
    expect(screen.getByText(/invite link/i)).toBeTruthy()
    expect(heading('Crew & seats')).toBeNull()
    expect(screen.getByRole('link', { name: 'Back to Play' }).getAttribute('href')).toBe('/play/')
  })

  test('still loading is not the same as not a member', async () => {
    await renderHub({ 'games:get': undefined })

    expect(screen.getByText(/Loading this Game/i)).toBeTruthy()
    expect(screen.queryByText(/not in this Game/i)).toBeNull()
  })
})

describe('Play from the Game page', () => {
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
  /** Unassigned, and held here: the browser that made it keeps its copy. */
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
    resetSync()
    const store = useUnits.getState()
    for (const [id, name] of HELD) {
      await store.adopt('pilot', pilotFixture({ id, name, gameId: 'g1' }))
    }
  })

  afterAll(async () => {
    // Leave the shared store as this file found it.
    const store = useUnits.getState()
    for (const [id] of HELD) await store.forget('pilot', id)
  })

  const launcher = () => screen.queryByRole('button', { name: 'Play' })

  async function openPicker(): Promise<HTMLElement> {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    })
    return screen.getByRole('dialog')
  }

  /** The pilots on offer, as their Compacts read: name, kind, then whose. */
  const offered = (dialog: HTMLElement) => within(dialog).queryAllByRole('radio').map(drawnText)

  /** The body of `/play/<id>`, signed in and connected. */
  async function openGate(id: string): Promise<void> {
    const connected = {
      status: 'live' as const,
      canWrite: true,
      outdated: false,
    }
    await act(async () => {
      render(
        <SyncContext.Provider value={connected}>
          <PlayGate id={id} />
        </SyncContext.Provider>
      )
    })
  }

  test('a player gets it in the band, above the roster', async () => {
    await renderHub({ 'games:members': MEDIATED })

    const button = launcher()
    expect(button).toBeTruthy()
    const pilots = screen.getByRole('heading', { level: 2, name: 'Crew' })
    expect(
      (button as HTMLElement).compareDocumentPosition(pilots) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  test('the Mediator’s is one Mediate link instead, opening Play’s Mediator screen', async () => {
    await renderHub({
      'games:get': { ...GAME, mediator: true, organizer: true },
      'games:members': ASH_MEDIATES,
      'mediator:amMediator': true,
    })
    expect(launcher()).toBeNull()
    const links = screen.getAllByRole('link', { name: 'Mediate' })
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/play/games/g1/mediate'])
  })

  test('a Game with no Mediator plays too', async () => {
    await renderHub({ 'entities:listForGame': listing(PILOTS) })
    const dialog = await openPicker()
    expect(offered(dialog)).toEqual(['Vex Arlo (Pilot)YouSelected', 'Mira (Pilot)You'])
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Play' }))
    })
    expect(navigations).toEqual([{ to: '/play/pilots/$pilotId', params: { pilotId: 'hub-mine' } }])
  })

  test('nothing shows while the crew is still loading', async () => {
    await renderHub({ 'games:members': undefined })
    expect(launcher()).toBeNull()
  })

  test('asks only for the pilot, yours first, with your first one chosen; Play opens it', async () => {
    await renderHub({ 'games:members': MEDIATED, 'entities:listForGame': listing(PILOTS) })
    const dialog = await openPicker()

    // The pilot is the only choice on offer, and a crewmate's is not one.
    const radios = within(dialog).getAllByRole('radio')
    expect(within(dialog).queryAllByRole('combobox')).toHaveLength(0)
    // The chosen Compact wears the "Selected" seal.
    expect(offered(dialog)).toEqual(['Vex Arlo (Pilot)YouSelected', 'Mira (Pilot)You'])
    expect(radios.map((r) => r.getAttribute('aria-checked') === 'true')).toEqual([true, false])

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Play' }))
    })
    expect(navigations).toEqual([{ to: '/play/pilots/$pilotId', params: { pilotId: 'hub-mine' } }])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('opened before the pilots answer, it says so, then chooses yours when they arrive', async () => {
    setQueryAnswers(answers({ 'games:members': MEDIATED, 'entities:listForGame': undefined }))
    let view: ReturnType<typeof render> | undefined
    await act(async () => {
      view = render(<GameHub gameId="g1" />)
    })
    const dialog = await openPicker()
    expect(within(dialog).getByText('Loading pilots…')).toBeTruthy()
    expect(within(dialog).queryByText(/saved in this browser/)).toBeNull()

    setQueryAnswers(answers({ 'games:members': MEDIATED, 'entities:listForGame': listing(PILOTS) }))
    await act(async () => {
      view?.rerender(<GameHub gameId="g1" />)
    })
    const radios = within(screen.getByRole('dialog')).getAllByRole('radio')
    expect(radios.map((r) => r.getAttribute('aria-checked') === 'true')).toEqual([true, false])
  })

  test('a viewer who owns no pilot gets no pre-selection, and picks one', async () => {
    await renderHub({
      'games:members': MEDIATED,
      'entities:listForGame': listing([THEIRS, PREGEN]),
    })
    const dialog = await openPicker()

    // Beefcake's pilot is not in this browser, so the gate could not open it.
    expect(offered(dialog)).toHaveLength(1)
    const radio = within(dialog).getByRole('radio', { name: /Pre-gen/ })
    expect(radio.getAttribute('aria-checked')).toBe('false')
    const launch = within(dialog).getByRole('button', { name: 'Play' })
    expect(launch.hasAttribute('disabled')).toBe(true)

    fireEvent.click(radio)
    expect(launch.hasAttribute('disabled')).toBe(false)
    await act(async () => {
      fireEvent.click(launch)
    })
    expect(navigations).toEqual([
      { to: '/play/pilots/$pilotId', params: { pilotId: 'hub-pregen' } },
    ])
  })

  test('a viewer who holds none of the Game’s pilots is told so, and offered nothing', async () => {
    await renderHub({
      'games:members': MEDIATED,
      'entities:listForGame': listing([THEIRS]),
    })
    const dialog = await openPicker()

    expect(offered(dialog)).toEqual([])
    expect(
      within(dialog).getByText(/None of this Game's pilots is saved in this browser/)
    ).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Play' }).hasAttribute('disabled')).toBe(true)
  })

  test('every pilot it offers opens Play at the gate, not "Pilot not found"', async () => {
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
        fireEvent.click(within(dialog).getByRole('button', { name: 'Play' }))
      })
      ids.push((navigations[0] as { params: { pilotId: string } }).params.pilotId)
      dialog = await openPicker()
    }
    expect(ids).toEqual(['hub-mine', 'hub-mine-2', 'hub-pregen'])

    for (const id of ids) {
      await openGate(id)
      expect(screen.getByText(`Play for ${id}`)).toBeTruthy()
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
