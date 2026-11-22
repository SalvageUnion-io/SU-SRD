import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

/**
 * `GameHub` — a Game's own page in Play, `/games/$gameId` (ADR-052 §5):
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
 * The Games reads are answered **by name** — see
 * `serverMock.ts`; the Game room serves the rest (`fakeRooms.ts`).
 */

import type { ReactNode } from 'react'
import { createElement } from 'react'
import { pilotFixture } from '../../../components/__tests__/fixtures'
import type { QueryAnswers } from '../../../components/__tests__/serverMock'
import { installServerMocks, setQueryAnswers } from '../../../components/__tests__/serverMock'
import { answerActs, closeRooms, openRooms, serveReads } from '../../../replica/__tests__/fakeRooms'

/** Every Games call (`games:destroy`) and act on the Game's room (`safety.showStop`), in order. */
const mutations: { name: string; args: unknown }[] = []
/** Every `router.navigate(opts)` the hub made. */
const navigations: unknown[] = []

// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs. See `serverMock.ts` for the capture/restore rules.
const serverMocks = await installServerMocks({
  call: (name, args) => {
    mutations.push({ name, args })
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
    // Relative to `serverMock.ts`, not this file. Whether the gate opens it,
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
const { CHAPTER_BAND_COLOR, ToasterMount } = await import('../../../components/index')

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
  openRooms('g1')
  answerActs(({ name, args }) => {
    mutations.push({ name, args })
  })
})

afterEach(closeRooms)

/** The Games reads answered, and the Game's room serving what the table reads answer. */
function answer(all: QueryAnswers): void {
  setQueryAnswers(all)
  serveReads('g1', all)
}

afterAll(() => {
  serverMocks.restore()
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
    'games.get': GAME,
    'account.me': { _id: 'u1', displayName: 'Ash' },
    'games.members': [
      { userId: 'u1', displayName: 'Ash', mediator: false, organizer: false, joinedAt: 1 },
      { userId: 'u2', displayName: 'Beefcake', mediator: false, organizer: false, joinedAt: 2 },
    ],
    'games.listing': { pilots: [], mechs: [], crawlers: [], softLinks: [] },
    'crew.vitals': undefined,
    'ops.pending': [],
    'downtime.state': { running: false, stepIndex: null, completedBy: [], upkeepSpent: false },
    'mediator.amMediator': false,
    'ops.sent': [],
    // A column's "Move in…" checks its moves against your Games.
    'games.listMine': [],
    'safety.stopSign': { stop: null, mayLift: false },
    // The Game's Discord channel row (MD-20).
    'channelBindings.current': null,
    // A member's own notes from when they ran the table: none, for most.
    'plan.mine': null,
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
  answer(answers(over))
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
  // MD2-07: the description and the next session's day reached nobody after the invite.
  test('every member reads what the Game is and when the table next meets', async () => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const now = new Date()
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    const soon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3)
    await renderHub({
      'games.get': {
        ...GAME,
        description: 'Sundays, 7pm.',
        sessionDays: [day(yesterday), day(soon)],
      },
    })
    const sidebar = within(screen.getByRole('complementary', { name: 'The Game' }))
    expect(sidebar.getByText('Sundays, 7pm.')).toBeTruthy()
    const next = sidebar.getByText('Next session').closest('.su-stat-cell') as HTMLElement
    expect(next.textContent).toContain(
      soon.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
    )
  })

  test('a Game with no day set says nothing of a next session', async () => {
    await renderHub()
    expect(screen.queryByText('Next session')).toBeNull()
  })

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
    await renderHub({ 'games.get': { ...GAME, organizer: true } })
    for (const name of ['Crew', 'Invite link', 'The Game']) {
      expect(heading(name)).toBeTruthy()
    }
  })
})

describe('the sections under the roster', () => {
  test('every member gets the answer queue and The Game, below the lists; no Crew & seats', async () => {
    await renderHub({
      'ops.pending': [
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
    // What a member may do is leave: the menu holds that and nothing of the Organiser's.
    await openGameMenu()
    expect(screen.getByRole('menuitem', { name: 'Leave this Game…' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Delete this Game…' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'Game settings…' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull()
  })

  test('a member leaves behind a confirm; their units go home, the page goes to Games (MD-11)', async () => {
    await renderHub()
    await openGameMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Leave this Game…' }))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain(
      'The Pilots and Mechs you brought go back to your Training Bay, and any this Game came with stay here, unassigned; nothing is deleted.'
    )
    expect(mutations).toHaveLength(0)
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Leave' }))
    })
    expect(mutations).toEqual([{ name: 'games.removeMember', args: { gameId: 'g1' } }])
    expect(navigations).toEqual([{ to: '/games' }])
  })

  test('the Organiser removes a member, and renames and describes the Game (MD-11, MD-12)', async () => {
    await renderHub({
      'games.get': { ...GAME, organizer: true },
      'games.members': [
        { userId: 'u1', displayName: 'Ash', mediator: false, organizer: true, joinedAt: 1 },
        { userId: 'u2', displayName: 'Beefcake', mediator: false, organizer: false, joinedAt: 2 },
      ],
    })
    // Nobody removes the Organiser, themselves included.
    expect(screen.queryByRole('button', { name: 'Remove Ash from this Game' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Remove Beefcake from this Game' }))
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' })
      )
    })
    // LG4-04: the link is the whole table's, and stays unless the Organiser ticks the box.
    expect(mutations).toEqual([
      { name: 'games.removeMember', args: { gameId: 'g1', userId: 'u2' } },
    ])
    expect(navigations).toEqual([])

    mutations.length = 0
    fireEvent.click(screen.getByRole('button', { name: 'Remove Beefcake from this Game' }))
    const removing = within(screen.getByRole('alertdialog'))
    const tick = removing.getByRole('checkbox', { name: 'Reset the invite link too' })
    expect((tick as HTMLInputElement).checked).toBe(false)
    // MD4-11: the words beside the box toggle it.
    fireEvent.click(removing.getByText('Reset the invite link too'))
    expect((tick as HTMLInputElement).checked).toBe(true)
    await act(async () => {
      fireEvent.click(removing.getByRole('button', { name: 'Remove' }))
    })
    expect(mutations).toEqual([
      { name: 'games.removeMember', args: { gameId: 'g1', userId: 'u2' } },
      { name: 'invites.reset', args: { gameId: 'g1' } },
    ])

    mutations.length = 0
    fireEvent.click(screen.getByRole('button', { name: 'Remove Beefcake from this Game' }))
    // It arrives unticked again.
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' })
      )
    })
    expect(mutations).toEqual([
      { name: 'games.removeMember', args: { gameId: 'g1', userId: 'u2' } },
    ])

    mutations.length = 0
    await openGameMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Game settings…' }))
    const settings = within(screen.getByRole('alertdialog'))
    expect((settings.getByLabelText('Name') as HTMLInputElement).value).toBe(GAME.name)
    fireEvent.change(settings.getByLabelText('Name'), { target: { value: 'Rust Coast' } })
    fireEvent.change(settings.getByLabelText('Description'), { target: { value: 'A long haul.' } })
    await act(async () => {
      fireEvent.click(settings.getByRole('button', { name: 'Save' }))
    })
    expect(mutations).toEqual([
      {
        name: 'games.update',
        args: { gameId: 'g1', name: 'Rust Coast', description: 'A long haul.' },
      },
    ])
  })

  test('the Organizer gets the invite link, who mediates, and ending the game', async () => {
    await renderHub({ 'games.get': { ...GAME, organizer: true } })

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
    // Each member is a small social card in the page's sidebar (R50): their
    // name, their roles as chips, none of their units.
    const sidebar = screen.getByRole('complementary', { name: 'The Game' })
    const members = within(sidebar).getByRole('list', { name: 'Members' })
    expect(within(members).getByText('Ash (you)')).toBeTruthy()
    expect(within(members).getByText('Beefcake')).toBeTruthy()
    expect(members.querySelector('[data-entity-linked]')).toBeNull()
    // R56: a person's name is never cut; the list wraps their chips under it.
    expect(members.hasAttribute('data-names-whole')).toBe(true)
  })

  test('alone at the table, Hand over rests and says why; a nameless viewer is You', async () => {
    await renderHub({
      'games.get': { ...GAME, organizer: true, mediator: true },
      'games.members': [
        { userId: 'u1', displayName: null, mediator: true, organizer: true, joinedAt: 1 },
      ],
    })
    const members = screen.getByRole('list', { name: 'Members' })
    expect(within(members).getByText('You')).toBeTruthy()
    expect(screen.queryByText('Crewmate (you)')).toBeNull()
    expect((screen.getByRole('button', { name: 'Hand over' }) as HTMLButtonElement).disabled).toBe(
      true
    )
    expect(screen.getByText(/Hand over needs another member/)).toBeTruthy()
  })

  test('members with no name go by their joining order, never one word for all (r6 C11)', async () => {
    await renderHub({
      'games.get': { ...GAME, organizer: true, mediator: true },
      'games.members': [
        { userId: 'u1', displayName: 'Ash', mediator: true, organizer: true, joinedAt: 1 },
        { userId: 'u2', displayName: null, mediator: false, organizer: false, joinedAt: 2 },
        { userId: 'u3', displayName: null, mediator: false, organizer: false, joinedAt: 3 },
      ],
    })
    const members = screen.getByRole('list', { name: 'Members' })
    expect(within(members).getByText('Player 2')).toBeTruthy()
    expect(within(members).getByText('Player 3')).toBeTruthy()
    expect(within(members).queryByText('Crewmate')).toBeNull()
  })

  test('Hand over appoints the chosen member first, then stands the old Mediator down', async () => {
    await renderHub({
      'games.get': { ...GAME, organizer: true, mediator: true },
      'games.members': [
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
      { name: 'games.setMediator', args: { gameId: 'g1', userId: 'u2', mediator: true } },
      { name: 'games.setMediator', args: { gameId: 'g1', userId: 'u1', mediator: false } },
    ])
  })

  // MD4-17: taking it back read as giving it away ("The new Mediator starts with empty notes").
  test('choosing yourself is taking the table back, in its own words', async () => {
    await renderHub({
      'games.get': { ...GAME, organizer: true },
      'games.members': [
        { userId: 'u1', displayName: 'Ash', mediator: false, organizer: true, joinedAt: 1 },
        { userId: 'u2', displayName: 'Beefcake', mediator: true, organizer: false, joinedAt: 2 },
      ],
    })
    // The button names the act: the table can only come back to the viewer (r5 B14).
    expect(screen.queryByRole('button', { name: 'Hand over' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Take back' }))
    const dialog = within(screen.getByRole('alertdialog'))
    expect(dialog.getAllByText('Take the table back?').length).toBeGreaterThan(0)
    expect(dialog.getByText(/^Comes to you: the table/)).toBeTruthy()
    expect(dialog.getByText(/you wrote before are yours to edit again/)).toBeTruthy()
    expect(dialog.queryByText(/The new Mediator starts with empty notes/)).toBeNull()
    await act(async () => {
      fireEvent.click(dialog.getByRole('button', { name: 'Take it back' }))
    })
    expect(mutations).toEqual([
      { name: 'games.setMediator', args: { gameId: 'g1', userId: 'u1', mediator: true } },
      { name: 'games.setMediator', args: { gameId: 'g1', userId: 'u2', mediator: false } },
    ])
  })

  // MD4-17: the notes that "stay with you" had no door once Prep left the page.
  test('a former Mediator reads the notes they wrote, read-only; nobody else gets the door', async () => {
    await renderHub()
    expect(heading('Your notes from when you ran it')).toBeNull()
    cleanup()
    await renderHub({
      'plan.mine': {
        notes: 'Vex works for the corpo.',
        sessions: [{ date: '2026-12-01', note: 'Ambush at dusk.' }, { note: 'Loose end.' }],
      },
    })
    expect(heading('Your notes from when you ran it')).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Read your notes' }))
    })
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText('Vex works for the corpo.')).toBeTruthy()
    expect(dialog.getByText('Ambush at dusk.')).toBeTruthy()
    expect(dialog.getByText('Loose end.')).toBeTruthy()
    expect(dialog.queryByRole('textbox')).toBeNull()
    expect(dialog.queryByRole('button', { name: /^Edit/ })).toBeNull()
  })

  test('ending the game asks first, says where everything lands, and then shows your Games', async () => {
    await renderHub({ 'games.get': { ...GAME, organizer: true } })

    await openGameMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete this Game…' }))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('It cannot be undone')
    expect(dialog.textContent).toContain('4 pilots and 3 mechs go back to whoever owns them')
    expect(dialog.textContent).toContain(
      'Hamlet and anything unassigned come to you, in your Training Bay'
    )
    // MD3-03: what goes is the field, said so; what was prepared stays, said so.
    expect(dialog.textContent).toContain('the Opposition on the field')
    expect(dialog.textContent).not.toContain('tray')
    expect(dialog.textContent).toContain(
      'The NPCs and encounters prepared for it stay in the Mediator’s Kit of whoever made them.'
    )
    expect(mutations).toHaveLength(0)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete Game' }))
    })
    expect(mutations).toEqual([{ name: 'games.destroy', args: { gameId: 'g1' } }])
    expect(navigations).toEqual([{ to: '/games' }])
  })

  // LG4-03: the dialog said "their Pilots and Mechs go back", the Game's own with them.
  test('removing a player names what goes home and which of the Game’s own stay', async () => {
    await renderHub({
      'games.get': { ...GAME, organizer: true, templateUnitIds: ['s-hotdog', 's-mazona'] },
      'games.members': [
        { userId: 'u1', displayName: 'Ash', mediator: false, organizer: true, joinedAt: 1 },
        { userId: 'u2', displayName: 'Cy', mediator: false, organizer: false, joinedAt: 2 },
      ],
      'games.listing': {
        pilots: [
          { _id: 's-hotdog', appId: 's-hotdog', ownerId: 'u2', body: { callsign: 'Hotdog' } },
          { _id: 's-own', appId: 's-own', ownerId: 'u2', body: { callsign: 'Wrench' } },
          { _id: 's-else', appId: 's-else', ownerId: 'u1', body: { callsign: 'Mine' } },
        ],
        mechs: [{ _id: 's-mazona', appId: 's-mazona', ownerId: 'u2', body: { name: 'Mazona' } }],
        crawlers: [],
        softLinks: [],
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Remove Cy from this Game' }))
    const dialog = within(screen.getByRole('alertdialog'))
    expect(dialog.getByText('Goes back to their Training Bay: Wrench.')).toBeTruthy()
    expect(dialog.getByText('Stays in this Game, unassigned: Hotdog, Mazona.')).toBeTruthy()
  })

  // MD2-02: a template tried and deleted left its thirteen units in the Training Bay.
  // MD4-10, MD4-11: the offer arrives unticked, and says where they go if it stays so.
  test('a template Game offers to take its untouched units, unticked, and says where they go', async () => {
    await renderHub({
      'games.get': { ...GAME, organizer: true, templateUnits: { came: 13, untouched: 13 } },
    })
    await openGameMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete this Game…' }))
    const also = screen.getByRole('checkbox', {
      name: 'Also delete the 13 units it came with?',
    }) as HTMLInputElement
    expect(also.checked).toBe(false)
    const dialog = within(screen.getByRole('alertdialog'))
    expect(dialog.getByText('Left unticked, they move to your Training Bay.')).toBeTruthy()
    // The words beside the box toggle it.
    fireEvent.click(dialog.getByText('Also delete the 13 units it came with?'))
    expect(also.checked).toBe(true)
    expect(dialog.queryByText('Left unticked, they move to your Training Bay.')).toBeNull()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete Game' }))
    })
    expect(mutations).toEqual([
      { name: 'games.destroy', args: { gameId: 'g1', dropTemplateUnits: true } },
    ])
  })

  test('with one of them changed the offer is unticked and counts only the untouched', async () => {
    await renderHub({
      'games.get': { ...GAME, organizer: true, templateUnits: { came: 13, untouched: 11 } },
    })
    await openGameMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete this Game…' }))
    const also = screen.getByRole('checkbox', {
      name: 'Also delete the 11 units it came with that nobody has changed?',
    }) as HTMLInputElement
    expect(also.checked).toBe(false)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete Game' }))
    })
    expect(mutations).toEqual([{ name: 'games.destroy', args: { gameId: 'g1' } }])
  })

  // MD4-10: eleven "X is now assigned to you" toasts, one a unit.
  test('deleting says once how many units moved to your Training Bay', async () => {
    answer(
      answers({
        'games.get': { ...GAME, organizer: true },
        'games.listing': {
          pilots: [
            { _id: 's-a', appId: 's-a', ownerId: null, body: { callsign: 'A' } },
            { _id: 's-b', appId: 's-b', ownerId: 'u2', body: { callsign: 'B' } },
          ],
          mechs: [{ _id: 's-m', appId: 's-m', ownerId: null, body: { name: 'M' } }],
          crawlers: [{ _id: 's-c', appId: 's-c', body: { name: 'Hamlet' } }],
          softLinks: [],
        },
      })
    )
    await act(async () => {
      render(
        <>
          <ToasterMount />
          <GameHub gameId="g1" />
        </>
      )
    })
    await openGameMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete this Game…' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete Game' }))
    })
    expect(
      await screen.findByText('Union Crawler #430 is deleted. 3 units moved to your Training Bay.')
    ).toBeTruthy()
  })

  test('a game with no crawler does not promise one', async () => {
    await renderHub({ 'games.get': { ...GAME, organizer: true, crawlerName: null, pilotCount: 0 } })
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
      'games.members': [
        { userId: 'u1', displayName: 'Ash', mediator: true, organizer: true, joinedAt: 1 },
        { userId: 'u2', displayName: 'Beefcake', mediator: false, organizer: false, joinedAt: 2 },
      ],
      'games.listing': {
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
      'crew.vitals': {
        viewerId: 'u1',
        mechs: [{ _id: 'm1', linkId: 'a-m1', techLevel: 2 }],
        pilots: [
          { _id: 'p1', currentHP: 4, maxHP: 10, mechId: 'a-m1' },
          { _id: 'p2', currentHP: null, maxHP: 8 },
        ],
      },
    })

    const crew = screen.getByRole('table', { name: 'Crew' })
    const line = (name: string) =>
      within(crew).getByRole('link', { name }).closest('tr') as HTMLElement
    const cells = (row: HTMLElement) => [...row.querySelectorAll('td')].map((td) => td.textContent)
    // A pilot's line: the mech they are in beside their name, its Tech Level
    // in the TL column, their HP in the HP column.
    const pickle = line('Pickle')
    expect(pickle.querySelector('th')?.textContent).toContain('in Spectrum')
    expect(cells(pickle).slice(1, 3)).toEqual(['2', '4/10'])
    // A piloted mech rides its pilot's line only, never a line of its own.
    expect(drawnText(crew).split('Spectrum')).toHaveLength(2)
    // An absent current HP is full.
    expect(cells(line('Hotdog'))[2]).toBe('8/8')
    // The head's tally says what it counts (r5 B14): `1/2 ASSIGNED`.
    expect(crew.querySelector('.su-rule-head__tally')?.textContent).toBe('1/2Assigned')
    expect(crew.querySelector('.su-rule-head__tally')?.getAttribute('title')).toBe(
      '1 of the 2 Pilots in this Game are assigned to a player.'
    )
    // No presence column: nothing writes it, and a false "Here" is worse than none.
    expect(screen.queryByText(/^(Here|Away)$/)).toBeNull()
  })
})

// MD2-10: a template Game listed every mech twice.
describe('a free pair, as a template’s arrive', () => {
  const pair = (mechOwner: string | null) => ({
    pilots: [{ _id: 'p2', appId: 'a-p2', ownerId: null, body: { id: 'a-p2', callsign: 'Hotdog' } }],
    mechs: [{ _id: 'm2', appId: 'a-m2', ownerId: mechOwner, body: { id: 'a-m2', name: 'Mule' } }],
    crawlers: [],
    softLinks: [{ type: 'mech-to-pilot', from: { id: 'a-m2' }, to: { id: 'a-p2' }, gameId: 'g1' }],
  })

  test('the mech is listed on its pilot’s line only, not under Mechs with no Pilot', async () => {
    await renderHub({ 'games.listing': pair(null) })
    const crew = screen.getByRole('table', { name: 'Crew' })
    expect(drawnText(crew)).toContain('in Mule')
    expect(drawnText(crew).split('Mule')).toHaveLength(2)
    expect(within(crew).queryByText('Mechs with no Pilot')).toBeNull()
  })

  test('held apart from its pilot, the mech keeps a line of its own', async () => {
    await renderHub({ 'games.listing': pair('u2') })
    const crew = screen.getByRole('table', { name: 'Crew' })
    expect(drawnText(crew).split('Mule').length).toBeGreaterThan(2)
  })
})

// MD-20: the Game's page and its settings had no word of the Discord channel.
describe('the Discord channel on the Game page', () => {
  /** Connected, so the bound channel is read. */
  async function renderLive(over: QueryAnswers = {}): Promise<void> {
    answer(answers(over))
    await act(async () => {
      render(
        <SyncContext.Provider value={{ status: 'live', canWrite: true, outdated: false }}>
          <GameHub gameId="g1" />
        </SyncContext.Provider>
      )
    })
  }

  test('a player reads who connects one; no control that could only say no', async () => {
    await renderLive()
    const sidebar = within(screen.getByRole('complementary', { name: 'The Game' }))
    expect(sidebar.getByText('Discord channel')).toBeTruthy()
    expect(sidebar.getByText('None bound: the Mediator or Organiser connects one')).toBeTruthy()
    expect(sidebar.queryByRole('button', { name: /Discord/ })).toBeNull()
  })

  test('the Organiser is offered Set up there, and in Game settings', async () => {
    await renderLive({ 'games.get': { ...GAME, organizer: true } })
    const sidebar = within(screen.getByRole('complementary', { name: 'The Game' }))
    expect(sidebar.getByText('None bound: rolls stay at the table')).toBeTruthy()
    expect(sidebar.getAllByRole('button', { name: /Discord channel/ }).length).toBe(1)
    await openGameMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Game settings…' }))
    const settings = within(screen.getByRole('alertdialog', { name: 'Game settings' }))
    expect(settings.getByText('Discord channel')).toBeTruthy()
  })
})

describe('the Mediator on the Game page', () => {
  test('a player, or an Organizer who does not mediate, gets no Mediator door', async () => {
    await renderHub({ 'games.get': { ...GAME, organizer: true } })
    expect(screen.queryByText('You mediate')).toBeNull()
    // Their way in is the player's Play button, not the Mediator's link.
    expect(screen.queryByRole('link', { name: 'Mediate' })).toBeNull()
    expect(heading('Proposals you sent')).toBeNull()
    expect(heading('Your prep')).toBeNull()
  })

  test('the table runner gets a door to this Game’s Prep, under its title (MD-02, MD-24)', async () => {
    await renderHub({ 'games.get': { ...GAME, mediator: true, tableRunner: true } })
    expect(heading('Prep')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open this Game’s Prep' }).getAttribute('href')).toBe(
      '/games/g1/prep'
    )
    // The band carries the same door, beside Mediate.
    expect(screen.getByRole('link', { name: 'Prep' }).getAttribute('href')).toBe('/games/g1/prep')
  })

  test('the Mediator gets the band’s door to Play and the proposals they sent', async () => {
    await renderHub({
      'games.get': { ...GAME, mediator: true },
      'ops.sent': [
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

    // The Mediate door alone says who mediates: no stamp beside it.
    expect(screen.queryByText('You mediate')).toBeNull()
    expect(screen.getByRole('link', { name: 'Mediate' }).getAttribute('href')).toBe(
      '/games/g1/mediate'
    )
    expect(heading('Proposals you sent')).toBeTruthy()
    expect(screen.getByText('Judge · HP → 4 · “Ejection burn”')).toBeTruthy()
    expect(screen.getByText('Pending')).toBeTruthy()
    // The instruments live in Play, not on this page.
    expect(screen.queryByRole('button', { name: 'Propose' })).toBeNull()
  })
})

describe('who plays whom', () => {
  test('each person in The Game wears the pilots they play; a crew row wears its Class', async () => {
    await renderHub({
      'games.listing': {
        pilots: [
          {
            _id: 'p1',
            appId: 'a-p1',
            ownerId: 'u2',
            body: { id: 'a-p1', name: 'Pickle', classRef: 'hacker' },
          },
        ],
        mechs: [],
        crawlers: [],
        softLinks: [],
      },
    })
    const game = screen.getByRole('region', { name: 'The Game' })
    const beefcake = [...game.querySelectorAll('li')].find((li) =>
      li.textContent?.includes('Beefcake')
    )
    expect(beefcake?.textContent).toContain('Pickle')
    // The crew line wears its Class, and its Member column names who holds it.
    const crew = screen.getByRole('table', { name: 'Crew' })
    expect(drawnText(crew)).toContain('Hacker')
    const pickle = within(crew).getByRole('link', { name: 'Pickle' }).closest('tr')
    expect(pickle?.querySelector('td')?.textContent).toBe('Beefcake')
  })
})

describe('the Mediator before they have proposed anything', () => {
  test('has no empty Proposals you sent', async () => {
    await renderHub({ 'games.get': { ...GAME, mediator: true }, 'ops.sent': [] })
    expect(screen.getByRole('link', { name: 'Mediate' })).toBeTruthy()
    expect(heading('Proposals you sent')).toBeNull()
  })
})

describe('a game the viewer is not in', () => {
  test('explains itself, and offers the way back to your Games, instead of rendering the table', async () => {
    await renderHub({ 'games.get': null })

    expect(screen.getByText(/not in this Game/i)).toBeTruthy()
    expect(screen.getByText(/invite link/i)).toBeTruthy()
    expect(heading('Crew & seats')).toBeNull()
    expect(screen.getByRole('link', { name: 'Back to Games' }).getAttribute('href')).toBe('/games/')
  })

  test('still loading is not the same as not a member', async () => {
    await renderHub({ 'games.get': undefined })

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

  const launcher = () => screen.queryByRole('button', { name: 'Open table' })

  async function openPicker(): Promise<HTMLElement> {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open table' }))
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
    await renderHub({ 'games.members': MEDIATED })

    const button = launcher()
    expect(button).toBeTruthy()
    const pilots = screen.getByRole('heading', { level: 2, name: 'Crew' })
    expect(
      (button as HTMLElement).compareDocumentPosition(pilots) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  test('the Mediator’s is one Mediate link instead, opening Play’s Mediator screen', async () => {
    await renderHub({
      'games.get': { ...GAME, mediator: true, organizer: true },
      'games.members': ASH_MEDIATES,
      'mediator.amMediator': true,
    })
    expect(launcher()).toBeNull()
    const links = screen.getAllByRole('link', { name: 'Mediate' })
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/games/g1/mediate'])
  })

  test('a Game with no Mediator plays too', async () => {
    await renderHub({ 'games.listing': listing(PILOTS) })
    const dialog = await openPicker()
    expect(offered(dialog)).toEqual(['Vex Arlo (Pilot)MineSelected', 'Mira (Pilot)Mine'])
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Open table as Vex Arlo' }))
    })
    expect(navigations).toEqual([{ to: '/pilots/$id/play', params: { id: 'hub-mine' } }])
  })

  test('nothing shows while the crew is still loading', async () => {
    // The Games reads answered, but the Game's room has served nothing yet.
    setQueryAnswers(answers())
    await act(async () => {
      render(<GameHub gameId="g1" />)
    })
    expect(launcher()).toBeNull()
  })

  test('asks only for the pilot, yours first, with your first one chosen; Play opens it', async () => {
    await renderHub({ 'games.members': MEDIATED, 'games.listing': listing(PILOTS) })
    const dialog = await openPicker()

    // The pilot is the only choice on offer, and a crewmate's is not one.
    const radios = within(dialog).getAllByRole('radio')
    expect(within(dialog).queryAllByRole('combobox')).toHaveLength(0)
    // The chosen Compact wears the "Selected" seal.
    expect(offered(dialog)).toEqual(['Vex Arlo (Pilot)MineSelected', 'Mira (Pilot)Mine'])
    expect(radios.map((r) => r.getAttribute('aria-checked') === 'true')).toEqual([true, false])

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Open table as Vex Arlo' }))
    })
    expect(navigations).toEqual([{ to: '/pilots/$id/play', params: { id: 'hub-mine' } }])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('opened before the pilots answer, it says so, then chooses yours when they arrive', async () => {
    answer(answers({ 'games.members': MEDIATED, 'games.listing': undefined }))
    let view: ReturnType<typeof render> | undefined
    await act(async () => {
      view = render(<GameHub gameId="g1" />)
    })
    const dialog = await openPicker()
    expect(within(dialog).getByText('Loading pilots…')).toBeTruthy()
    expect(within(dialog).queryByText(/saved in this browser/)).toBeNull()

    answer(answers({ 'games.members': MEDIATED, 'games.listing': listing(PILOTS) }))
    await act(async () => {
      view?.rerender(<GameHub gameId="g1" />)
    })
    const radios = within(screen.getByRole('dialog')).getAllByRole('radio')
    expect(radios.map((r) => r.getAttribute('aria-checked') === 'true')).toEqual([true, false])
  })

  // The band's door pressed before the pilots answered opened a dialog that
  // then needed a second press: with one pilot of yours it goes in once they do.
  test('pressed before the pilots answer, one pilot of yours opens once they arrive', async () => {
    answer(answers({ 'games.members': MEDIATED, 'games.listing': undefined }))
    let view: ReturnType<typeof render> | undefined
    await act(async () => {
      view = render(<GameHub gameId="g1" />)
    })
    const dialog = await openPicker()
    expect(within(dialog).getByText('Loading pilots…')).toBeTruthy()
    expect(navigations).toEqual([])

    answer(
      answers({ 'games.members': MEDIATED, 'games.listing': listing([THEIRS, PILOTS[1], PREGEN]) })
    )
    await act(async () => {
      view?.rerender(<GameHub gameId="g1" />)
    })
    expect(navigations).toEqual([{ to: '/pilots/$id/play', params: { id: 'hub-mine' } }])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // LG-24: one pilot of yours is no choice, so the button opens Play for it.
  test('with one pilot of yours it goes straight in, asking nothing', async () => {
    await renderHub({
      'games.members': MEDIATED,
      'games.listing': listing([THEIRS, PILOTS[1], PREGEN]),
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open table' }))
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(navigations).toEqual([{ to: '/pilots/$id/play', params: { id: 'hub-mine' } }])
  })

  // LG-01, LG-24: a crewmate's pilot and an unassigned one are not yours to
  // play, held in this browser or not.
  test('a viewer with no pilot of their own is told so, and offered nothing', async () => {
    await renderHub({
      'games.members': MEDIATED,
      'games.listing': listing([THEIRS, PREGEN]),
    })
    const dialog = await openPicker()

    expect(offered(dialog)).toEqual([])
    expect(within(dialog).getByText(/No Pilot in this Game is assigned to you/)).toBeTruthy()
    expect(
      within(dialog).getByRole('button', { name: 'Open table' }).hasAttribute('disabled')
    ).toBe(true)
  })

  test('every pilot it offers opens Play at the gate, not "Pilot not found"', async () => {
    await renderHub({
      'games.members': MEDIATED,
      'games.listing': listing([...PILOTS, PREGEN]),
    })
    let dialog = await openPicker()
    const count = within(dialog).getAllByRole('radio').length
    const ids: string[] = []
    for (let i = 0; i < count; i++) {
      fireEvent.click(within(dialog).getAllByRole('radio')[i] as HTMLElement)
      navigations.length = 0
      await act(async () => {
        fireEvent.click(within(dialog).getByRole('button', { name: /^Open table as / }))
      })
      ids.push((navigations[0] as { params: { id: string } }).params.id)
      dialog = await openPicker()
    }
    // Yours only: the unassigned pre-gen is on the Crew list, to assign first.
    expect(ids).toEqual(['hub-mine', 'hub-mine-2'])

    for (const id of ids) {
      await openGate(id)
      expect(screen.getByText(`Play for ${id}`)).toBeTruthy()
    }
    expect(screen.queryByRole('heading', { name: 'Pilot not found' })).toBeNull()

    await openGate('a-theirs')
    expect(screen.getByRole('heading', { name: 'Pilot not found' })).toBeTruthy()
  })

  test('the dialog takes focus, and Escape closes it without launching', async () => {
    await renderHub({ 'games.members': MEDIATED, 'games.listing': listing(PILOTS) })
    const dialog = await openPicker()

    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    await act(async () => {
      fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(navigations).toHaveLength(0)
  })
})

describe('Safety (Core Book pp.12-13)', () => {
  /** The hub as `GamePage` mounts it: connected, so the Stop Sign is read. */
  async function renderConnected(over: QueryAnswers): Promise<void> {
    answer(answers(over))
    const connected = {
      status: 'live' as const,
      canWrite: true,
      outdated: false,
    }
    await act(async () => {
      render(
        <SyncContext.Provider value={connected}>
          <GameHub gameId="g1" />
        </SyncContext.Provider>
      )
    })
  }

  test('there is no Discord opt-in: a bound channel always gets the Stop Sign', async () => {
    await renderHub()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  test('while the Stop Sign is up, the head’s button says so by being disabled', async () => {
    // The words and Resume play are the pinned notice's, over every screen (`TableNotices`).
    await renderConnected({
      'safety.stopSign': {
        stop: { shownAt: 1, mine: false },
        mayLift: false,
      },
    })
    expect(
      (screen.getByRole('button', { name: 'Show the Stop Sign' }) as HTMLButtonElement).disabled
    ).toBe(true)
  })

  test('Stop Sign on the section’s head shows it', async () => {
    await renderConnected({})
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Show the Stop Sign' }))
    })
    expect(mutations).toEqual([{ name: 'safety.showStop', args: {} }])
  })
})
