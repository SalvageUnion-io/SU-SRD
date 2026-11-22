import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { RoomDeclined } from '../../../replica/roomSocket'

/**
 * `GameRoster` — a Game's crew on its page in Play, one list, connected.
 *
 * What is worth testing here is not that the list renders; it is that the
 * surface tells the truth about **what you may do**, because every control on
 * it corresponds to a server rule that will refuse. The cases below are the
 * ones where showing the wrong thing is actively harmful:
 *
 *  - offering a sheet for a crewmate's pilot (an editor whose saves are refused)
 *  - offering to pick up something somebody already holds
 *  - hiding the crawler link from the only person who can raise one
 *  - offering Build's verbs (create, copy) inside Play
 *
 * That each kind lists YOUR rows first and everyone else's after — the
 * crewmates' with their name on the seal.
 *
 * And, for every verb that changes who has a build — pick up, offer, remove
 * from game, delete, scrap — that it asks first: nothing happens until
 * the confirm is pressed, Cancel leaves everything as it was, and a failure
 * keeps the dialog open with a reason.
 *
 * Queries are answered **by name** — see `serverMock.ts`.
 * This component asks for: account.me and games.listing; the roster is the Game socket's.
 * Mutations are recorded by name the same way.
 */

import { crawlerFixture, mechFixture, pilotFixture } from '../../../components/__tests__/fixtures'
import { installServerMocks, setQueryAnswers } from '../../../components/__tests__/serverMock'
import { closeRooms, serve } from '../../../replica/__tests__/fakeRooms'

/** Every Games call the surface made, by name, with its args. */
const mutations: { name: string; args: unknown }[] = []
/** Set to make the next mutation throw this. */
let mutationError: unknown = null

// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs. See `serverMock.ts` for the capture/restore rules.
const serverMocks = await installServerMocks({
  call: (name, args) => {
    if (mutationError !== null) throw mutationError
    mutations.push({ name, args })
    // Taking a pre-gen off the roster answers the ids that left.
    return name === 'games.takeOffRoster' ? ['s-free', 's-free-mech'] : undefined
  },
})

const { GameRoster } = await import('../GameRoster')
const { ToasterMount } = await import('../../../components/index')
const { hydrateStores } = await import('../../../components/__tests__/hydrateStores')
const { useUnits } = await import('../../../replica/units')
const { setSyncStatus } = await import('../../../replica/sync')

beforeAll(hydrateStores)

afterAll(async () => {
  // Leave the shared stores as this file found them: empty.
  for (const id of ['a-mine', 'a-crawler', 'a-shelf', 'a-away']) {
    await useUnits.getState().forget(id === 'a-crawler' ? 'crawler' : 'pilot', id)
  }
})

beforeEach(() => {
  mutations.length = 0
  mutationError = null
})

const ME = { _id: 'u-me', displayName: 'Me', avatarUrl: null, email: null }

const MEMBERS = [
  { userId: 'u-med', displayName: 'Mediator', mediator: true, organizer: true },
  { userId: 'u-me', displayName: 'Me', mediator: false, organizer: false },
]

const MY_PILOT = {
  _id: 's-mine',
  appId: 'a-mine',
  ownerId: 'u-me',
  body: { id: 'a-mine', name: 'Roach-Boy', callsign: 'Roach-Boy', currentHP: 8 },
}
const THEIR_PILOT = {
  _id: 's-theirs',
  appId: 'a-theirs',
  ownerId: 'u-med',
  body: { id: 'a-theirs', name: 'Ash' },
}
const PRE_GEN = {
  _id: 's-free',
  appId: null,
  ownerId: null,
  body: { id: 'a-free', name: 'Pre-gen' },
}
const MY_MECH = {
  _id: 's-mech',
  appId: 'a-mech',
  ownerId: 'u-me',
  body: { id: 'a-mech', name: 'Iron Mongrel', chassisRef: 'iron-mongrel', currentSP: 12 },
}
const CRAWLER = {
  _id: 's-crawler',
  appId: 'a-crawler',
  body: { id: 'a-crawler', name: '#430 Tenacity', techLevel: '1' },
}

/** Your Games, as `games.listMine` answers: this one and another you play in. */
const MY_GAMES = [
  { _id: 'g1', name: 'Tenacity', tableRunner: false },
  { _id: 'g2', name: 'Frostline', tableRunner: false },
]

function listing(over: Record<string, unknown> = {}) {
  return { pilots: [], mechs: [], crawlers: [], softLinks: [], ...over }
}

/** Render as `viewer`, against one crew listing. */
async function renderAs(
  me: unknown,
  rows: ReturnType<typeof listing>,
  members: unknown = MEMBERS,
  pregens?: readonly string[]
): Promise<void> {
  // The roster, as the Game's socket serves it.
  serve('g1', { members: members as Record<string, unknown>[] })
  setQueryAnswers({
    'account.me': me,
    'games.listing': rows,
    'crew.vitals': undefined,
    'games.listMine': MY_GAMES,
  })
  // Async act: the roster flips its hydrated flag from a promise after mount.
  await act(async () => {
    render(
      <>
        <ToasterMount />
        <GameRoster gameId="g1" gameName="Tenacity" pregens={pregens} />
      </>
    )
  })
}

/** Open a row's ⋯ menu (`More for <name>`) and return it. */
async function openMenu(name: string): Promise<HTMLElement> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: `More for ${name}` }))
  })
  return screen.getByRole('menu')
}

/** Close the open ⋯ menu, so the next row's can be opened alone. */
async function closeMenu(menu: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.keyDown(menu, { key: 'Escape' })
  })
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
}

/** The verbs a row's ⋯ menu lists, in order; the menu is closed again after. */
async function verbsOf(name: string): Promise<string[]> {
  const menu = await openMenu(name)
  const verbs = within(menu)
    .getAllByRole('menuitem')
    .map((item) => item.textContent ?? '')
  await closeMenu(menu)
  return verbs
}

/** The rows (by name) whose ⋯ menu offers `verb`. */
async function rowsOffering(names: readonly string[], verb: string): Promise<string[]> {
  const offering: string[] = []
  for (const name of names) {
    if ((await verbsOf(name)).includes(verb)) offering.push(name)
  }
  return offering
}

describe('what a row offers', () => {
  test('your own pilot’s whole row opens the live sheet — no separate Edit', async () => {
    await renderAs(ME, listing({ pilots: [MY_PILOT] }))
    expect(screen.getByText('Roach-Boy')).toBeTruthy()
    // One door per row, to the one sheet: it opens editable because it is
    // yours (`SheetView`), so there is no second verb for editing.
    const row = screen.getByRole('link', { name: 'Roach-Boy' })
    expect(row.getAttribute('href')).toBe('/pilots/a-mine')
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(await verbsOf('Roach-Boy')).not.toContain('Edit')
  })

  test('the ⋯ menu’s Open goes to the same sheet as the row', async () => {
    await renderAs(ME, listing({ pilots: [MY_PILOT] }))
    expect((await verbsOf('Roach-Boy'))[0]).toBe('Open sheet')
  })

  test('a pre-gen with no app id opens by its body id', async () => {
    await renderAs(ME, listing({ pilots: [PRE_GEN] }))
    const view = screen.getByRole('link', { name: 'Pre-gen' })
    expect(view.getAttribute('href')).toBe('/pilots/a-free')
  })

  test('no row opens Play: that is the hub’s Play', async () => {
    await renderAs(ME, listing({ pilots: [MY_PILOT, THEIR_PILOT], mechs: [MY_MECH] }))
    // Even your own pilot.
    expect(screen.queryByRole('button', { name: 'Open table' })).toBeNull()
    expect(screen.queryByRole('link', { name: /^(Play|Mediate)$/ })).toBeNull()
  })

  test('what is assigned to you can be handed back to the crew', async () => {
    await renderAs(ME, listing({ pilots: [MY_PILOT] }))
    // An assignment is voluntary outward (ADR-030 §4), and the seal's confirm
    // promises this as the way back out — so it cannot be Mediator-only.
    expect(await verbsOf('Roach-Boy')).toContain('Unassign')
  })

  test("but a crewmate's cannot, nor be assigned to anyone", async () => {
    await renderAs(ME, listing({ pilots: [THEIR_PILOT] }))
    const verbs = await verbsOf('Ash')
    expect(verbs).not.toContain('Unassign')
    expect(verbs.filter((v) => v.startsWith('Assign to'))).toEqual([])
  })

  test('the Mediator may unassign or reassign anybody’s, to anyone in the Game', async () => {
    await renderAs({ ...ME, _id: 'u-med' }, listing({ pilots: [MY_PILOT, PRE_GEN] }))
    const verbs = await verbsOf('Roach-Boy')
    expect(verbs).toContain('Unassign')
    expect(verbs).toContain('Assign to me')
    // Not to the member who already holds it.
    expect(verbs).not.toContain('Assign to Me')
  })

  test("a crewmate's pilot opens the same live sheet, with no holder seal", async () => {
    await renderAs(ME, listing({ pilots: [THEIR_PILOT] }))

    expect(screen.getByText('Ash')).toBeTruthy()
    // A held row names its holder in the Member column; it carries no seal
    // (only an unassigned one does).
    const line = screen.getByRole('link', { name: 'Ash' }).closest('tr')
    expect(line?.querySelector('td')?.textContent).toBe('Mediator')
    // A phone drops that column: the holder's name is kept under the Pilot's (r4 B8).
    expect(line?.querySelector('th .su-open__phone-only')?.textContent).toContain('Mediator')
    expect(document.querySelectorAll('th .su-open__phone-only')).toHaveLength(1)
    // Readable: a shared table whose crew you cannot look at is not shared.
    // The same address as your own rows; `SheetView` renders it read-only.
    const row = screen.getByRole('link', { name: 'Ash' })
    expect(row.getAttribute('href')).toBe('/pilots/a-theirs')
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    // Nor is it takeable: somebody already holds it.
    expect(screen.queryByRole('button', { name: /^Assign to me: / })).toBeNull()
  })

  test('a crewmate has no delete affordance on your screen', async () => {
    await renderAs(ME, listing({ pilots: [THEIR_PILOT] }))

    // Game rows carry no trash at all — leaving a character you hold is
    // "Unassign", and deleting the crawler is the table runner's;
    // copying is Build's. Nothing here can destroy somebody else's build.
    expect(await verbsOf('Ash')).toEqual(['Open sheet'])
  })
})

describe('assigning yourself what nobody holds', () => {
  // r3 L3 (LG3-06): the way to take a pilot was a dark tag reading "Unassigned".
  test('a free pre-gen carries an Assign to me button, in the glossary’s words', async () => {
    await renderAs(ME, listing({ pilots: [PRE_GEN] }))

    const take = screen.getByRole('button', { name: 'Assign to me: Pre-gen' })
    expect(take.textContent).toBe('Assign to me')
    expect(screen.queryByRole('button', { name: /Unassigned/i })).toBeNull()
    // The row's menu says the same words.
    expect(await verbsOf('Pre-gen')).toContain('Assign to me')
  })

  test('pressing the seal asks before it assigns', async () => {
    await renderAs(ME, listing({ pilots: [PRE_GEN] }))
    fireEvent.click(screen.getByRole('button', { name: /^Assign to me: / }))

    // Taking a character is a commitment at the table, so the seal opens a
    // confirm that says what happens next rather than assigning on one click.
    // The dialog carries its title twice — visible heading plus the sr-only
    // accessible label — so this counts rather than demanding a single match.
    expect(screen.getAllByText(/Assign Pre-gen to you\?/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Assign to me' })).toBeTruthy()
  })
})

describe('what the game will accept', () => {
  test('a player may bring a pilot before any crawler exists (ADR-037)', async () => {
    await renderAs(ME, listing())

    // The crew gathers first; the first crawler raised picks them up.
    expect(screen.getByText('+ New Pilot')).toBeTruthy()
    expect(screen.queryByText('+ New Crawler')).toBeNull()
  })

  test('and once the crawler exists', async () => {
    await renderAs(ME, listing({ crawlers: [CRAWLER] }))
    expect(screen.getByText('+ New Pilot')).toBeTruthy()
  })

  test('a player is never offered the crawler CTA', async () => {
    await renderAs(ME, listing({ crawlers: [CRAWLER] }))
    expect(screen.queryByText('+ New Crawler')).toBeNull()
  })

  test('the table runner may raise one before anything else exists', async () => {
    const mediator = { ...ME, _id: 'u-med', displayName: 'Mediator' }
    await renderAs(mediator, listing())

    expect(screen.getByText('+ New Crawler')).toBeTruthy()
    // Exempt from the crawler gate, or a new game could never be set up.
    expect(screen.getByText('+ New Pilot')).toBeTruthy()
  })

  test('the primary crawler is marked, and only the table runner can make another one primary', async () => {
    const SECOND = {
      _id: 's-crawler-2',
      appId: 'a-crawler-2',
      body: { id: 'a-crawler-2', name: 'Second Wind', techLevel: '1' },
    }
    const rows = listing({ crawlers: [CRAWLER, SECOND], primaryCrawlerId: CRAWLER._id })

    const crawlers = ['#430 Tenacity', 'Second Wind']
    await renderAs(ME, rows)
    expect(screen.getByText('★ Primary')).toBeTruthy()
    expect(await rowsOffering(crawlers, 'Make primary')).toEqual([])

    cleanup()
    await renderAs({ ...ME, _id: 'u-med' }, rows)
    // Only the other one: the primary is already primary.
    expect(await rowsOffering(crawlers, 'Make primary')).toEqual(['Second Wind'])
  })

  test('Make primary runs at once, for the crawler it was chosen on', async () => {
    const SECOND = {
      _id: 's-crawler-2',
      appId: 'a-crawler-2',
      body: { id: 'a-crawler-2', name: 'Second Wind', techLevel: '1' },
    }
    await renderAs(
      { ...ME, _id: 'u-med' },
      listing({ crawlers: [CRAWLER, SECOND], primaryCrawlerId: CRAWLER._id })
    )
    await choose(await openMenu('Second Wind'), 'Make primary')
    expect(mutations).toEqual([
      { name: 'games.setPrimaryCrawler', args: { gameId: 'g1', crawlerId: 's-crawler-2' } },
    ])
  })

  test('only the table runner may delete a crawler', async () => {
    await renderAs(ME, listing({ crawlers: [CRAWLER] }))
    expect(await verbsOf('#430 Tenacity')).not.toContain('Delete…')

    cleanup()
    await renderAs({ ...ME, _id: 'u-med' }, listing({ crawlers: [CRAWLER] }))
    expect(await verbsOf('#430 Tenacity')).toContain('Delete…')
  })

  test('the crawler opens for every member to read', async () => {
    await renderAs(ME, listing({ crawlers: [CRAWLER] }))

    expect(screen.getByText('#430 Tenacity')).toBeTruthy()
    expect(screen.getByRole('link', { name: '#430 Tenacity' }).getAttribute('href')).toBe(
      '/crawlers/a-crawler'
    )
    // It has no owner at all, so it carries no ownership seal — neither a
    // claim invitation nor a holder's name. "Who owns the crawler" is not a
    // question the game asks.
    expect(screen.queryByRole('button', { name: /^Assign to me: / })).toBeNull()
  })
})

describe('yours first, then everyone else', () => {
  test('your rows lead, wearing MINE; the rest follow, and only the unassigned one wears a seal', async () => {
    await renderAs(ME, listing({ pilots: [THEIR_PILOT, MY_PILOT, PRE_GEN] }))

    // One list, no group headings: the seal says whose each row is.
    expect(screen.queryByText('Yours')).toBeNull()
    expect(screen.queryByText('Everyone else')).toBeNull()
    // Yours leads, whatever order the server listed them in; then the
    // crewmate's and the unassigned pre-gen, in the listing's order.
    const names = screen
      .getAllByRole('link', { name: /^(Roach-Boy|Ash|Pre-gen)$/ })
      .map((link) => link.getAttribute('aria-label') ?? link.textContent)
    expect(names).toEqual(['Roach-Boy', 'Ash', 'Pre-gen'])
    // Your row wears MINE (its stamp, and its Member cell).
    const mine = screen.getByRole('link', { name: 'Roach-Boy' }).closest('tr')
    expect(within(mine as HTMLElement).getAllByText('Mine').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /^Assign to me: / })).toBeTruthy()
  })

  test("crawlers are nobody's — the primary leads", async () => {
    const SECOND = {
      _id: 's-crawler-2',
      appId: 'a-crawler-2',
      body: { id: 'a-crawler-2', name: 'Second Wind', techLevel: '1' },
    }
    await renderAs(ME, listing({ crawlers: [SECOND, CRAWLER], primaryCrawlerId: CRAWLER._id }))
    // The rows, in order — each Compact is a link named for its unit.
    const names = screen
      .getAllByRole('link', { name: /^(#430 Tenacity|Second Wind)$/ })
      .map((link) => link.getAttribute('aria-label') ?? link.textContent)
    expect(names).toEqual(['#430 Tenacity', 'Second Wind'])
  })
})

describe('make a copy', () => {
  test('is Build’s: no row offers it in Play', async () => {
    await renderAs(ME, listing({ pilots: [MY_PILOT, THEIR_PILOT, PRE_GEN], crawlers: [CRAWLER] }))
    expect(
      await rowsOffering(['Roach-Boy', 'Ash', 'Pre-gen', '#430 Tenacity'], 'Make a copy')
    ).toEqual([])
  })
})

/** The names of the pilots this browser holds, to see whether a copy landed. */
const localPilotNames = () =>
  useUnits
    .getState()
    .list('pilot')
    .map((p) => p.name)

/** Choose a verb in an open ⋯ menu. */
async function choose(menu: HTMLElement, verb: string): Promise<void> {
  await act(async () => {
    fireEvent.click(within(menu).getByRole('menuitem', { name: verb }))
  })
}

/** Choose `verb` in `row`'s ⋯ menu and return the confirm it opened. */
async function press(row: string, verb: string): Promise<HTMLElement> {
  await choose(await openMenu(row), verb)
  return screen.getByRole('alertdialog')
}

/**
 * Drive store work that outlasts one act() scope (the stubbed server commit)
 * to completion in small act() blocks, polling `done` between them. Bounded at ~1s.
 */
async function settle(done: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !done(); i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
  }
}

/** Press the confirm button inside the open dialog, and let the work settle. */
async function confirmWith(label: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: label }))
  })
}

describe('every verb that changes who has a build asks first', () => {
  test('Unassign says what you give up, and unassigns nothing until confirmed', async () => {
    await renderAs(ME, listing({ pilots: [MY_PILOT] }))
    const dialog = await press('Roach-Boy', 'Unassign')

    expect(dialog.textContent).toContain('Unassign Roach-Boy?')
    expect(dialog.textContent).toContain("You'll stop editing Roach-Boy")
    expect(mutations).toHaveLength(0)

    await confirmWith('Unassign')
    expect(mutations).toEqual([
      { name: 'ownership.unassign', args: { gameId: 'g1', entityId: 's-mine' } },
    ])
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  // MD-10: the Crew list reads the replica, so dropping the copy held here took
  // the pilot's line away until a reload. The room serves it again, unassigned.
  test('Unassign keeps the pilot in this browser, for the Crew list to show unassigned', async () => {
    await useUnits
      .getState()
      .adopt('pilot', pilotFixture({ id: 'a-mine', name: 'Roach-Boy', gameId: 'g1' }))
    await renderAs(ME, listing({ pilots: [MY_PILOT] }))
    await press('Roach-Boy', 'Unassign')
    await confirmWith('Unassign')
    expect(mutations.map((m) => m.name)).toEqual(['ownership.unassign'])
    expect(useUnits.getState().get('pilot', 'a-mine')?.name).toBe('Roach-Boy')
  })

  test('Deleting the crawler says it is for everyone and permanent, and deletes nothing until confirmed', async () => {
    await renderAs({ ...ME, _id: 'u-med' }, listing({ crawlers: [CRAWLER] }))
    const dialog = await press('#430 Tenacity', 'Delete…')

    expect(dialog.textContent).toContain('Delete #430 Tenacity?')
    expect(dialog.textContent).toContain("for everyone in the Game and can't be undone")
    expect(mutations).toHaveLength(0)

    await confirmWith('Delete')
    expect(mutations).toEqual([
      { name: 'entities.removeCrawler', args: { gameId: 'g1', crawlerId: 's-crawler' } },
    ])
  })

  test('Delete keeps its cannot-be-undone warning, and deletes nothing until confirmed', async () => {
    await renderAs(ME, listing({ pilots: [MY_PILOT] }))
    const dialog = await press('Roach-Boy', 'Delete…')

    expect(dialog.textContent).toContain('This cannot be undone.')
    expect(mutations).toHaveLength(0)

    await confirmWith('Delete')
    expect(mutations).toEqual([
      { name: 'entities.remove', args: { gameId: 'g1', entityId: 's-mine' } },
    ])
  })

  test('Assign to me assigns nothing until confirmed', async () => {
    await renderAs(ME, listing({ pilots: [PRE_GEN] }))
    fireEvent.click(screen.getByRole('button', { name: /^Assign to me: / }))
    expect(mutations).toHaveLength(0)

    await confirmWith('Assign to me')
    expect(mutations).toEqual([
      { name: 'ownership.assign', args: { gameId: 'g1', entityId: 's-free' } },
    ])
  })

  // MD4-09: each pre-gen handed out was three presses, and the row read as a failed act.
  test('the Mediator’s Assign to … assigns at once, and its toast’s Undo puts it back', async () => {
    await renderAs({ ...ME, _id: 'u-med' }, listing({ pilots: [PRE_GEN, MY_PILOT] }))
    await choose(await openMenu('Pre-gen'), 'Assign to Me')
    await settle(() => mutations.length > 0)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(mutations).toEqual([
      { name: 'ownership.assign', args: { gameId: 'g1', entityId: 's-free', userId: 'u-me' } },
    ])
    expect(await screen.findByText('Pre-gen is assigned to Me.')).toBeTruthy()
    // It was nobody's: Undo unassigns it.
    mutations.length = 0
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    })
    await settle(() => mutations.length > 0)
    expect(mutations).toEqual([
      { name: 'ownership.unassign', args: { gameId: 'g1', entityId: 's-free' } },
    ])

    // One somebody held goes back to them.
    mutations.length = 0
    await choose(await openMenu('Roach-Boy'), 'Assign to me')
    await settle(() => mutations.length > 0)
    const said = (await screen.findByText('Roach-Boy is assigned to you.')).closest(
      'li'
    ) as HTMLElement
    mutations.length = 0
    await act(async () => {
      fireEvent.click(within(said).getByRole('button', { name: 'Undo' }))
    })
    await settle(() => mutations.length > 0)
    expect(mutations).toEqual([
      { name: 'ownership.assign', args: { gameId: 'g1', entityId: 's-mine', userId: 'u-me' } },
    ])
  })

  test('an Assign to … that fails says so', async () => {
    await renderAs({ ...ME, _id: 'u-med' }, listing({ pilots: [PRE_GEN] }))
    mutationError = new Error('socket closed')
    const errors = spyOn(console, 'error').mockImplementation(() => {})
    await choose(await openMenu('Pre-gen'), 'Assign to Me')
    expect(await screen.findByText('Pre-gen could not be assigned to Me. Try again.')).toBeTruthy()
    errors.mockRestore()
  })

  // LG4-20: four spare pre-gens stayed in the crew list and in the seats.
  test('the Organiser takes an unused pre-gen off the roster at once, with Undo', async () => {
    const mech = {
      _id: 's-free-mech',
      appId: null,
      ownerId: null,
      body: { id: 's-free-mech', name: 'Mazona', chassisRef: 'iron-mongrel' },
    }
    const flies = {
      id: 'l1',
      type: 'mech-to-pilot',
      from: { type: 'mech', id: 's-free-mech' },
      to: { type: 'pilot', id: 'a-free' },
    }
    await renderAs(
      { ...ME, _id: 'u-med' },
      listing({ pilots: [PRE_GEN, MY_PILOT], mechs: [mech], softLinks: [flies] }),
      MEMBERS,
      ['s-free', 's-free-mech', 's-mine']
    )
    // Only an unassigned one: a pre-gen a player holds is not offered.
    expect(await rowsOffering(['Pre-gen', 'Roach-Boy'], 'Take off the roster')).toEqual(['Pre-gen'])
    await choose(await openMenu('Pre-gen'), 'Take off the roster')
    await settle(() => mutations.length > 0)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(mutations).toEqual([
      { name: 'games.takeOffRoster', args: { gameId: 'g1', pilotId: 's-free' } },
    ])
    expect(
      // Where they went, said plainly (r5 B15).
      await screen.findByText('Pre-gen and Mazona are back in your Training Bay.')
    ).toBeTruthy()
    mutations.length = 0
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    })
    await settle(() => mutations.length > 0)
    expect(mutations).toEqual([
      { name: 'games.putBack', args: { gameId: 'g1', unitIds: ['s-free', 's-free-mech'] } },
    ])
  })

  test('nobody but the Organiser of a template Game is offered Take off the roster', async () => {
    await renderAs(ME, listing({ pilots: [PRE_GEN] }))
    expect(await verbsOf('Pre-gen')).not.toContain('Take off the roster')
  })

  test.each([
    ['Unassign', MY_PILOT],
    ['Delete…', MY_PILOT],
  ] as const)('Cancel on %s leaves everything as it was', async (verb, pilot) => {
    await renderAs(ME, listing({ pilots: [pilot] }))
    const before = localPilotNames()
    await press('Roach-Boy', verb)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(mutations).toHaveLength(0)
    expect(localPilotNames()).toEqual(before)
  })

  test('Cancel on deleting the crawler leaves it alone', async () => {
    await renderAs({ ...ME, _id: 'u-med' }, listing({ crawlers: [CRAWLER] }))
    await press('#430 Tenacity', 'Delete…')

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(mutations).toHaveLength(0)
  })

  test('a refusal stays on the dialog, in the words the server chose', async () => {
    await renderAs(ME, listing({ pilots: [MY_PILOT] }))
    await press('Roach-Boy', 'Unassign')
    mutationError = new RoomDeclined('A build in your Training Bay is already yours')

    await confirmWith('Unassign')
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe(
      'A build in your Training Bay is already yours'
    )
  })

  test('any other failure stays on the dialog with a plain reason, never the raw error', async () => {
    await renderAs({ ...ME, _id: 'u-med' }, listing({ crawlers: [CRAWLER] }))
    await press('#430 Tenacity', 'Delete…')
    mutationError = new Error('entities.removeCrawler failed')

    await confirmWith('Delete')
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe(
      '#430 Tenacity could not be deleted. Try again.'
    )
  })
})

describe('remove from game', () => {
  /** This browser holds the copy a move is made on — the feed brings it in. */
  async function holdLocally(): Promise<void> {
    setSyncStatus('live')
    await useUnits
      .getState()
      .adopt('pilot', pilotFixture({ id: 'a-mine', name: 'Roach-Boy', gameId: 'g1' }))
  }
  const gameIdOf = (id: string) => useUnits.getState().get('pilot', id)?.gameId

  test('is offered on your own pilot once its copy is here, and on nobody else’s', async () => {
    await renderAs(ME, listing({ pilots: [MY_PILOT, THEIR_PILOT, PRE_GEN] }))
    const pilots = ['Roach-Boy', 'Ash', 'Pre-gen']
    // Not yet in this browser: nothing to move from here.
    expect(await rowsOffering(pilots, 'Move to your Training Bay')).toEqual([])

    cleanup()
    await holdLocally()
    await renderAs(ME, listing({ pilots: [MY_PILOT, THEIR_PILOT, PRE_GEN] }))
    expect(await rowsOffering(pilots, 'Move to your Training Bay')).toEqual(['Roach-Boy'])
  })

  test('asks first — naming the game and the assignments it clears — and moves nothing until confirmed', async () => {
    await holdLocally()
    await renderAs(ME, listing({ pilots: [MY_PILOT] }))
    const dialog = await press('Roach-Boy', 'Move to your Training Bay')

    expect(dialog.textContent).toContain('Move Roach-Boy out of Tenacity?')
    expect(dialog.textContent).toContain('goes back to your Training Bay')
    expect(dialog.textContent).toContain('Their crawler assignment in Tenacity is cleared')
    expect(gameIdOf('a-mine')).toBe('g1')

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(gameIdOf('a-mine')).toBe('g1')
  })

  test('confirming moves the same record to your shelves', async () => {
    await holdLocally()
    await renderAs(ME, listing({ pilots: [MY_PILOT] }))
    await press('Roach-Boy', 'Move to your Training Bay')

    await confirmWith('Move to your Training Bay')
    // The move commits to the (stubbed) server first, which outlasts one act() scope.
    await settle(() => screen.queryByRole('alertdialog') === null)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    // A move, never a copy: same id, `gameId` cleared.
    expect(gameIdOf('a-mine')).toBeNull()
  })

  test('a crawler comes out at the table runner’s hand only', async () => {
    setSyncStatus('live')
    await useUnits
      .getState()
      .adopt('crawler', crawlerFixture({ id: 'a-crawler', name: '#430 Tenacity', gameId: 'g1' }))

    await renderAs(ME, listing({ crawlers: [CRAWLER] }))
    expect(await verbsOf('#430 Tenacity')).not.toContain('Move to your Training Bay')

    cleanup()
    await renderAs({ ...ME, _id: 'u-med' }, listing({ crawlers: [CRAWLER] }))
    const dialog = await press('#430 Tenacity', 'Move to your Training Bay')
    expect(dialog.textContent).toContain('Everyone in Tenacity assigned to it is unassigned')
  })
})

describe('units in from Build (ADR-052 §3, §5)', () => {
  test('the head links out to Build’s wizards for this Game, and nothing else', async () => {
    const mediator = { ...ME, _id: 'u-med', displayName: 'Mediator' }
    await renderAs(mediator, listing())
    const hrefOf = (name: string) => screen.getByRole('link', { name }).getAttribute('href')
    expect(hrefOf('+ New Pilot')).toBe('/pilots/new?game=g1')
    expect(hrefOf('+ New Mech')).toBe('/mechs/new?game=g1')
    expect(hrefOf('+ New Crawler')).toBe('/crawlers/new?game=g1')
    expect(screen.queryByRole('link', { name: 'Manage in Build' })).toBeNull()
    // Nothing that builds lives here.
    expect(screen.queryByText('Create Mech')).toBeNull()
    expect(screen.queryByText('Patterns')).toBeNull()
    expect(screen.queryByText('Move in…')).toBeNull()
  })

  /** Leave the shared store as the test found it, the page still mounted. */
  const forgetHeld = async (...held: ['pilot' | 'mech', string][]) => {
    cleanup()
    for (const [kind, id] of held) await useUnits.getState().forget(kind, id)
  }

  /** Nothing of the player's held here: what the files before this left is forgotten. */
  const emptyBay = async () => {
    const { pilots, mechs } = useUnits.getState()
    for (const p of pilots) await useUnits.getState().forget('pilot', p.id)
    for (const m of mechs) await useUnits.getState().forget('mech', m.id)
  }

  const openBring = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Add from Training Bay' }))
    return await screen.findByRole('dialog', { name: 'Bring into this Game' })
  }

  test('Add from Training Bay brings one of your own in: the same record moves', async () => {
    setSyncStatus('live')
    await useUnits.getState().adopt('mech', mechFixture({ id: 'm-bay', name: 'Rust Bucket' }))
    await renderAs(ME, listing())
    const dialog = await openBring()
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Rust Bucket' }))
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Move in' }))
    })
    await settle(() => useUnits.getState().mechs.find((m) => m.id === 'm-bay')?.gameId === 'g1')
    expect(useUnits.getState().mechs.find((m) => m.id === 'm-bay')?.gameId).toBe('g1')
    await forgetHeld(['mech', 'm-bay'])
  })

  test('several at once, and a pilot brings their mech, still assigned (LG-08)', async () => {
    setSyncStatus('live')
    const store = useUnits.getState()
    await store.adopt('pilot', pilotFixture({ id: 'p-bay', name: 'Razor' }))
    await store.adopt('mech', mechFixture({ id: 'm-pair', name: 'Thresher' }))
    await store.adopt('mech', mechFixture({ id: 'm-spare', name: 'Spare' }))
    await store.create('softLink', {
      from: { type: 'mech', id: 'm-pair' },
      to: { type: 'pilot', id: 'p-bay' },
      type: 'mech-to-pilot',
    })
    await renderAs(ME, listing())
    const dialog = await openBring()
    // The pair is one line: the mech rides under its pilot, not on its own.
    expect(within(dialog).queryByRole('checkbox', { name: 'Thresher' })).toBeNull()
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Razor' }))
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Spare' }))
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Move in' }))
    })
    const inGame = (kind: 'pilots' | 'mechs', id: string) =>
      useUnits.getState()[kind].find((u) => u.id === id)?.gameId === 'g1'
    const paired = () =>
      useUnits
        .getState()
        .softLinks.some(
          (l) => l.type === 'mech-to-pilot' && l.from.id === 'm-pair' && l.to.id === 'p-bay'
        )
    await settle(
      () =>
        inGame('pilots', 'p-bay') &&
        inGame('mechs', 'm-pair') &&
        inGame('mechs', 'm-spare') &&
        paired()
    )
    expect(inGame('pilots', 'p-bay')).toBe(true)
    expect(inGame('mechs', 'm-pair')).toBe(true)
    expect(inGame('mechs', 'm-spare')).toBe(true)
    // Nothing asked: the pair came through whole.
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(paired()).toBe(true)
    await forgetHeld(['mech', 'm-pair'], ['mech', 'm-spare'], ['pilot', 'p-bay'])
  })

  /** Two Bay pilots crewing a Bay crawler: bringing either in alone leaves the crawler behind. */
  const crewedBay = async () => {
    setSyncStatus('live')
    await emptyBay()
    const store = useUnits.getState()
    await store.adopt('crawler', crawlerFixture({ id: 'c-bay', name: 'Old Reliable' }))
    await store.adopt('pilot', pilotFixture({ id: 'p-one', name: 'Razor' }))
    await store.adopt('pilot', pilotFixture({ id: 'p-two', name: 'Gauge' }))
    for (const id of ['p-one', 'p-two']) {
      await store.create('softLink', {
        from: { type: 'pilot', id },
        to: { type: 'crawler', id: 'c-bay' },
        type: 'pilot-to-crawler',
      })
    }
  }
  const crewOf = (id: string) =>
    useUnits.getState().softLinks.some((l) => l.type === 'pilot-to-crawler' && l.from.id === id)
  const inGame = (id: string) =>
    useUnits.getState().pilots.find((p) => p.id === id)?.gameId === 'g1'
  const forgetCrewedBay = async () => {
    cleanup()
    const store = useUnits.getState()
    for (const id of ['p-one', 'p-two']) await store.forget('pilot', id)
    await store.forget('crawler', 'c-bay')
  }

  test('bringing in one whose assignment stays behind asks first, naming what is cleared', async () => {
    await crewedBay()
    await renderAs(ME, listing())
    const dialog = await openBring()
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Razor' }))
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Move in' }))
    })
    const ask = await screen.findByRole('alertdialog')
    expect(ask.textContent).toContain('Move Razor into Tenacity?')
    expect(ask.textContent).toContain('Old Reliable')
    // Nothing has moved until the confirm is pressed.
    expect(inGame('p-one')).toBe(false)
    expect(crewOf('p-one')).toBe(true)

    await confirmWith('Move')
    await settle(() => inGame('p-one') && !crewOf('p-one'))
    expect(inGame('p-one')).toBe(true)
    expect(crewOf('p-one')).toBe(false)
    // The crewmate who stayed is still the crawler's crew.
    expect(crewOf('p-two')).toBe(true)
    await forgetCrewedBay()
  })

  test('several at once ask once, each one’s cleared assignment under its own name', async () => {
    await crewedBay()
    await renderAs(ME, listing())
    const dialog = await openBring()
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Razor' }))
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Gauge' }))
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Move in' }))
    })
    const ask = await screen.findByRole('alertdialog')
    expect(ask.textContent).toContain('Move these into Tenacity?')
    expect(ask.textContent).toMatch(/Razor: .*Old Reliable/)
    expect(ask.textContent).toMatch(/Gauge: .*Old Reliable/)
    expect(ask.textContent).toContain('you’ll need to make those assignments again')

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(inGame('p-one')).toBe(false)
    expect(inGame('p-two')).toBe(false)
    expect(crewOf('p-one') && crewOf('p-two')).toBe(true)
    await forgetCrewedBay()
  })

  test('a mech of yours is paired with your pilot from its row: Assign to a Pilot… (LG-07)', async () => {
    setSyncStatus('live')
    await emptyBay()
    const store = useUnits.getState()
    await store.adopt('pilot', pilotFixture({ id: 'a-mine', name: 'Roach-Boy', gameId: 'g1' }))
    await store.adopt('mech', mechFixture({ id: 'a-mech', name: 'Iron Mongrel', gameId: 'g1' }))
    await renderAs(ME, listing({ pilots: [MY_PILOT, THEIR_PILOT], mechs: [MY_MECH] }))
    // The mech's own verb, and only on a mech.
    expect(await rowsOffering(['Roach-Boy', 'Ash', 'Iron Mongrel'], 'Assign to a Pilot…')).toEqual([
      'Iron Mongrel',
    ])

    const menu = await openMenu('Iron Mongrel')
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Assign to a Pilot…' }))
    })
    const dialog = await screen.findByRole('dialog', { name: 'Assign Iron Mongrel to a Pilot' })
    // Yours only, and the one with no mech is chosen already.
    const radios = within(dialog).getAllByRole('radio')
    expect(radios).toHaveLength(1)
    expect(radios[0]?.getAttribute('aria-checked')).toBe('true')
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Assign' }))
    })
    const paired = () =>
      useUnits
        .getState()
        .softLinks.some(
          (l) => l.type === 'mech-to-pilot' && l.from.id === 'a-mech' && l.to.id === 'a-mine'
        )
    await settle(paired)
    expect(paired()).toBe(true)
    await forgetHeld(['mech', 'a-mech'], ['pilot', 'a-mine'])
  })

  test('with nothing built it says so, and offers the ways to have one (LG-10)', async () => {
    setSyncStatus('live')
    await emptyBay()
    await renderAs(ME, listing())
    const dialog = await openBring()
    expect(within(dialog).getByText(/You have no Pilots or Mechs yet/)).toBeTruthy()
    expect(within(dialog).queryByText(/is already in a Game/)).toBeNull()
    const hrefOf = (name: string) => within(dialog).getByRole('link', { name }).getAttribute('href')
    expect(hrefOf('+ New Pilot')).toBe('/pilots/new?game=g1')
    expect(hrefOf('+ New Mech')).toBe('/mechs/new?game=g1')
    expect(hrefOf('Starter Set')).toBe('/starter')
    expect(within(dialog).getByRole('button', { name: 'Move in' }).hasAttribute('disabled')).toBe(
      true
    )
  })

  test('with everything in a Game already, it says that instead', async () => {
    setSyncStatus('live')
    await useUnits
      .getState()
      .adopt('mech', mechFixture({ id: 'm-away', name: 'Away', gameId: 'g2' }))
    await renderAs(ME, listing())
    const dialog = await openBring()
    expect(within(dialog).getByText(/is already in a Game/)).toBeTruthy()
    expect(within(dialog).getByRole('link', { name: 'Starter Set' })).toBeTruthy()
    await forgetHeld(['mech', 'm-away'])
  })
})

afterEach(closeRooms)
afterAll(serverMocks.restore)
