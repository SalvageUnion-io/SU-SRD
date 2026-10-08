import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ConvexError } from 'convex/values'

/**
 * `GameRoster` — a Game's crew in the hub's columns, connected.
 *
 * What is worth testing here is not that three columns render; it is that the
 * surface tells the truth about **what you may do**, because every control on
 * it corresponds to a server rule that will refuse. The cases below are the
 * ones where showing the wrong thing is actively harmful:
 *
 *  - offering a sheet for a crewmate's pilot (an editor whose saves are refused)
 *  - offering to pick up something somebody already holds
 *  - offering "create" in a Game with no crawler, which the server rejects
 *  - hiding the crawler CTA from the only person who can raise one
 *
 * That each column lists YOUR rows first, framed under YOURS, and everyone
 * else's below — the crewmates' with their name on the seal.
 *
 * And, for every verb that changes who has a build — pick up, offer, copy,
 * remove from game, delete, scrap — that it asks first: nothing happens until
 * the confirm is pressed, Cancel leaves everything as it was, and a failure
 * keeps the dialog open with a reason.
 *
 * Queries are answered **by name** (`getFunctionName`) — see `convexMock.ts`.
 * This component asks for: account.me, games.members, entities.listForGame.
 * Mutations are recorded by name the same way.
 */

import { getFunctionName } from 'convex/server'
import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'
import { crawlerFixture, pilotFixture } from '../../__tests__/fixtures'

/** Every mutation the surface ran, by `getFunctionName`, with its args. */
const mutations: { name: string; args: unknown }[] = []
/** Set to make the next mutation throw this. */
let mutationError: unknown = null

// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs. See `convexMock.ts` for the capture/restore rules.
const convexMocks = await installConvexMocks({
  convexReact: {
    useMutation: (ref: unknown) => async (args: unknown) => {
      if (mutationError !== null) throw mutationError
      mutations.push({ name: getFunctionName(ref as never), args })
    },
  },
})

const { GameRoster } = await import('../GameRoster')
const { hydrateStores } = await import('../../__tests__/hydrateStores')
const { useEntityStore } = await import('../../../stores/entityStore')
const { setEntityBackendAuthState } = await import('../../../stores/entityBackend')

beforeAll(hydrateStores)

afterAll(async () => {
  // Leave the shared stores as this file found them: empty.
  for (const id of ['a-mine', 'a-crawler']) {
    await useEntityStore.getState().forget(id === 'a-crawler' ? 'crawler' : 'pilot', id)
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
/**
 * A crewmate's pilot with a COMPLETE body. A copy goes through
 * `entityStore.create`, which Zod-parses the body, so the sketch bodies above
 * would be refused on the way in.
 */
const WHOLE_PILOT = {
  _id: 's-whole',
  appId: 'a-whole',
  ownerId: 'u-med',
  body: pilotFixture({ id: 'a-whole', name: 'Vex Arlo' }),
}
const CRAWLER = {
  _id: 's-crawler',
  appId: 'a-crawler',
  body: { id: 'a-crawler', name: '#430 Tenacity', techLevel: '1' },
}

function listing(over: Record<string, unknown> = {}) {
  return { pilots: [], mechs: [], crawlers: [], softLinks: [], ...over }
}

/** Render as `viewer`, against one crew listing. */
async function renderAs(
  me: unknown,
  rows: ReturnType<typeof listing>,
  members: unknown = MEMBERS
): Promise<void> {
  setQueryAnswers({
    'account:me': me,
    'games:members': members,
    'entities:listForGame': rows,
  })
  // Async act: the roster flips its hydrated flag from a promise after mount.
  await act(async () => {
    render(
      <GameRoster
        gameId="g1"
        gameName="Tenacity"
        activeSegment="pilot"
        onSegmentChange={() => {}}
      />
    )
  })
}

describe('what a row offers', () => {
  test('your own pilot opens the live sheet — one View, no separate Edit', async () => {
    await renderAs(ME, listing({ pilots: [MY_PILOT] }))
    expect(screen.getByText('Roach-Boy')).toBeTruthy()
    // One door per row, to the one sheet: it opens editable because it is
    // yours (`SheetView`), so there is no second verb for editing.
    const view = screen.getByRole('link', { name: 'View Roach-Boy' })
    expect(view.getAttribute('href')).toBe('/sheet/pilot/a-mine')
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
  })

  test('a pre-gen with no app id opens by its body id', async () => {
    await renderAs(ME, listing({ pilots: [PRE_GEN] }))
    const view = screen.getByRole('link', { name: 'View Pre-gen' })
    expect(view.getAttribute('href')).toBe('/sheet/pilot/a-free')
  })

  test('no row launches the Dashboard: that is the hub’s Launch Dashboard', async () => {
    await renderAs(ME, listing({ pilots: [MY_PILOT, THEIR_PILOT], mechs: [MY_MECH] }))
    // Even your own pilot, in a Game with a Mediator (ADR-038 §1).
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull()
    expect(screen.queryByRole('button', { name: /dashboard/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /dashboard/i })).toBeNull()
  })

  test('what you own can be handed back to the crew', async () => {
    await renderAs(ME, listing({ pilots: [MY_PILOT] }))
    // Ownership is voluntary outward (ADR-030 §4), and the pick-up confirm
    // promises this as the way back out — so it cannot be Mediator-only.
    expect(screen.getByRole('button', { name: 'Offer to the crew' })).toBeTruthy()
  })

  test("but a crewmate's cannot", async () => {
    await renderAs(ME, listing({ pilots: [THEIR_PILOT] }))
    expect(screen.queryByRole('button', { name: 'Offer to the crew' })).toBeNull()
  })

  test("a crewmate's pilot names its holder and opens the same live sheet", async () => {
    await renderAs(ME, listing({ pilots: [THEIR_PILOT] }))

    expect(screen.getByText('Ash')).toBeTruthy()
    // The seal names who holds it — the row's one ownership mark.
    expect(screen.getByText('Mediator')).toBeTruthy()
    // Readable: a shared table whose crew you cannot look at is not shared.
    // The same address as your own rows; `SheetView` renders it read-only.
    const view = screen.getByRole('link', { name: /^View / })
    expect(view.getAttribute('href')).toBe('/sheet/pilot/a-theirs')
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    // Nor is it takeable: somebody already holds it.
    expect(screen.queryByRole('button', { name: /Unclaimed/i })).toBeNull()
  })

  test('a crewmate has no delete affordance on your screen', async () => {
    await renderAs(ME, listing({ pilots: [THEIR_PILOT] }))

    // Game rows carry no trash at all — leaving a character you hold is
    // "Offer to the crew", and the crawler's Scrap is the table runner's.
    // Nothing here can destroy somebody else's build.
    expect(screen.queryByRole('button', { name: /Delete Ash/i })).toBeNull()
  })
})

describe('picking up what nobody holds', () => {
  test('an unclaimed pre-gen carries an UNCLAIMED seal', async () => {
    await renderAs(ME, listing({ pilots: [PRE_GEN] }))

    // Unclaimed is a STATE, not a blank — and the mark announcing it is the
    // same control you press to take the character.
    expect(screen.getByRole('button', { name: /Unclaimed/i })).toBeTruthy()
  })

  test('pressing the seal asks before it claims', async () => {
    await renderAs(ME, listing({ pilots: [PRE_GEN] }))
    fireEvent.click(screen.getByRole('button', { name: /Unclaimed/i }))

    // Taking a character is a commitment at the table, so the seal opens a
    // confirm that says what happens next rather than claiming on one click.
    // The dialog carries its title twice — visible heading plus the sr-only
    // accessible label — so this counts rather than demanding a single match.
    expect(screen.getAllByText(/Pick up Pre-gen\?/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Pick up' })).toBeTruthy()
  })
})

describe('what the game will accept', () => {
  test('a player may add crew before any crawler exists (ADR-037)', async () => {
    await renderAs(ME, listing())

    // The crew gathers first; the first crawler raised picks them up. The
    // Crawlers column still says who raises one.
    expect(screen.getByText('Create Pilot')).toBeTruthy()
    expect(screen.getAllByText(/no Union Crawler yet/i).length).toBeGreaterThan(0)
  })

  test('and can create once the crawler exists', async () => {
    await renderAs(ME, listing({ crawlers: [CRAWLER] }))
    expect(screen.getByText('Create Pilot')).toBeTruthy()
  })

  test('a player is never offered the crawler CTA', async () => {
    await renderAs(ME, listing({ crawlers: [CRAWLER] }))
    expect(screen.queryByText('Raise a Crawler')).toBeNull()
  })

  test('the table runner may raise one before anything else exists', async () => {
    const mediator = { ...ME, _id: 'u-med', displayName: 'Mediator' }
    await renderAs(mediator, listing())

    expect(screen.getByText('Raise a Crawler')).toBeTruthy()
    // Exempt from the crawler gate, or a new game could never be set up.
    expect(screen.getByText('Create Pilot')).toBeTruthy()
  })

  test('the primary crawler is marked, and only the table runner can make another one primary', async () => {
    const SECOND = {
      _id: 's-crawler-2',
      appId: 'a-crawler-2',
      body: { id: 'a-crawler-2', name: 'Second Wind', techLevel: '1' },
    }
    const rows = listing({ crawlers: [CRAWLER, SECOND], primaryCrawlerId: CRAWLER._id })

    await renderAs(ME, rows)
    expect(screen.getByText('★ Primary')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Make primary' })).toBeNull()

    cleanup()
    await renderAs({ ...ME, _id: 'u-med' }, rows)
    // One button: the primary is already primary.
    expect(screen.getAllByRole('button', { name: 'Make primary' })).toHaveLength(1)
  })

  test('only the table runner may scrap a crawler', async () => {
    await renderAs(ME, listing({ crawlers: [CRAWLER] }))
    expect(screen.queryByRole('button', { name: 'Scrap' })).toBeNull()

    cleanup()
    await renderAs({ ...ME, _id: 'u-med' }, listing({ crawlers: [CRAWLER] }))
    expect(screen.getByRole('button', { name: 'Scrap' })).toBeTruthy()
  })

  test('the crawler opens for every member to read', async () => {
    await renderAs(ME, listing({ crawlers: [CRAWLER] }))

    expect(screen.getByText('#430 Tenacity')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'View #430 Tenacity' }).getAttribute('href')).toBe(
      '/sheet/crawler/a-crawler'
    )
    // It has no owner at all, so it carries no ownership seal — neither a
    // claim invitation nor a holder's name. "Who owns the crawler" is not a
    // question the game asks.
    expect(screen.queryByRole('button', { name: /Unclaimed/i })).toBeNull()
  })
})

describe('yours first, then everyone else', () => {
  test('your rows lead each column under YOURS; the rest follow, with their holder named', async () => {
    await renderAs(ME, listing({ pilots: [THEIR_PILOT, MY_PILOT, PRE_GEN] }))

    const yours = screen.getByRole('list', { name: 'Yours' })
    const others = screen.getByRole('list', { name: 'Everyone else' })
    expect(within(yours).getByText('Roach-Boy')).toBeTruthy()
    expect(within(yours).queryByText('Ash')).toBeNull()
    // Everyone else's: the crewmate's (their name on the seal) and the
    // unclaimed pre-gen, in the listing's order.
    expect(within(others).getByText('Ash')).toBeTruthy()
    expect(within(others).getByText('Mediator')).toBeTruthy()
    expect(within(others).getByRole('button', { name: /Unclaimed/i })).toBeTruthy()

    // YOURS is above everything else, whatever order the server listed them in.
    const position = yours.compareDocumentPosition(others)
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('with nothing of yours there is no YOURS group, only the crew', async () => {
    await renderAs(ME, listing({ pilots: [THEIR_PILOT] }))
    expect(screen.queryByRole('list', { name: 'Yours' })).toBeNull()
    expect(screen.queryByRole('list', { name: 'Everyone else' })).toBeNull()
    expect(screen.getByText('Ash')).toBeTruthy()
  })

  test('crawlers have no YOURS group — the primary leads', async () => {
    const SECOND = {
      _id: 's-crawler-2',
      appId: 'a-crawler-2',
      body: { id: 'a-crawler-2', name: 'Second Wind', techLevel: '1' },
    }
    await renderAs(ME, listing({ crawlers: [SECOND, CRAWLER], primaryCrawlerId: CRAWLER._id }))
    const names = screen
      .getAllByRole('link', { name: /^View / })
      .map((link) => link.getAttribute('aria-label'))
    expect(names).toEqual(['View #430 Tenacity', 'View Second Wind'])
  })
})

describe('copy to My Stuff', () => {
  test('every character offers it, including ones you do not own', async () => {
    await renderAs(ME, listing({ pilots: [MY_PILOT, THEIR_PILOT, PRE_GEN] }))

    // Derived from what you may already read: membership grants the frozen crew
    // view of every row, so copying what is on screen escalates nothing. It is
    // also the only way to keep a character when you walk away from the table:
    // releasing one leaves it behind, unclaimed.
    expect(screen.getAllByRole('button', { name: 'Copy to My Stuff' })).toHaveLength(3)
  })

  test('the crawler does not — a deliberate hold, no longer an impossibility', async () => {
    await renderAs(ME, listing({ crawlers: [CRAWLER] }))

    // This assertion is unchanged but its reason is not. A shelved crawler was
    // once unrepresentable (`crawlers.gameId` was non-nullable); it is ordinary
    // now. The crawler is the crew's shared home rather than a character
    // somebody keeps, so offering "copy the table's crawler to your shelf" is a
    // product decision that has not been made — and this test is what will fail
    // first, loudly and in the right place, when somebody makes it.
    expect(screen.queryByRole('button', { name: 'Copy to My Stuff' })).toBeNull()
  })
})

/** The names of the pilots this browser holds, to see whether a copy landed. */
const localPilotNames = () =>
  useEntityStore
    .getState()
    .list('pilot')
    .map((p) => p.name)

/** Press a row verb and return the confirm it opened. */
function press(name: string): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name }))
  return screen.getByRole('alertdialog')
}

/**
 * Drive store work that outlasts one act() scope (IndexedDB) to completion in
 * small act() blocks, polling `done` between them. Bounded at ~1s.
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
  test('Offer to the crew says what you give up, and releases nothing until confirmed', async () => {
    await renderAs(ME, listing({ pilots: [MY_PILOT] }))
    const dialog = press('Offer to the crew')

    expect(dialog.textContent).toContain('Offer Roach-Boy to the crew?')
    expect(dialog.textContent).toContain("You'll stop owning Roach-Boy")
    expect(mutations).toHaveLength(0)

    await confirmWith('Offer to the crew')
    expect(mutations).toEqual([
      { name: 'ownership:release', args: { table: 'pilots', entityId: 's-mine' } },
    ])
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  test('Copy to My Stuff says the copy is separate, and copies nothing until confirmed', async () => {
    // Signed out, so the copy's create stays in the in-memory backend: this
    // file's Convex client is a stub with no `mutation`, and the backend's auth
    // state is process-global, so another file can leave it signed in.
    setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
    await renderAs(ME, listing({ pilots: [WHOLE_PILOT] }))
    const dialog = press('Copy to My Stuff')

    expect(dialog.textContent).toContain('Copy Vex Arlo to My Stuff?')
    expect(dialog.textContent).toContain("won't sync back")
    expect(localPilotNames()).not.toContain('COPY OF Vex Arlo')

    await confirmWith('Make a copy')
    expect(localPilotNames()).toContain('COPY OF Vex Arlo')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  test('Scrap says it is for everyone and permanent, and scraps nothing until confirmed', async () => {
    await renderAs({ ...ME, _id: 'u-med' }, listing({ crawlers: [CRAWLER] }))
    const dialog = press('Scrap')

    expect(dialog.textContent).toContain('Scrap #430 Tenacity?')
    expect(dialog.textContent).toContain("for everyone in the game and can't be undone")
    expect(mutations).toHaveLength(0)

    await confirmWith('Scrap')
    expect(mutations).toEqual([
      { name: 'entities:removeCrawler', args: { crawlerId: 's-crawler' } },
    ])
  })

  test('Delete keeps its cannot-be-undone warning, and deletes nothing until confirmed', async () => {
    await renderAs(ME, listing({ pilots: [MY_PILOT] }))
    const dialog = press('Delete')

    expect(dialog.textContent).toContain('This cannot be undone.')
    expect(mutations).toHaveLength(0)

    await confirmWith('Delete')
    expect(mutations).toEqual([
      { name: 'entities:remove', args: { table: 'pilots', entityId: 's-mine' } },
    ])
  })

  test('Pick up claims nothing until confirmed', async () => {
    await renderAs(ME, listing({ pilots: [PRE_GEN] }))
    fireEvent.click(screen.getByRole('button', { name: /Unclaimed/i }))
    expect(mutations).toHaveLength(0)

    await confirmWith('Pick up')
    expect(mutations).toEqual([
      { name: 'ownership:claim', args: { table: 'pilots', entityId: 's-free' } },
    ])
  })

  test.each([
    ['Offer to the crew', MY_PILOT],
    ['Copy to My Stuff', MY_PILOT],
    ['Delete', MY_PILOT],
  ] as const)('Cancel on %s leaves everything as it was', async (verb, pilot) => {
    await renderAs(ME, listing({ pilots: [pilot] }))
    const before = localPilotNames()
    press(verb)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(mutations).toHaveLength(0)
    expect(localPilotNames()).toEqual(before)
  })

  test('Cancel on Scrap leaves the crawler alone', async () => {
    await renderAs({ ...ME, _id: 'u-med' }, listing({ crawlers: [CRAWLER] }))
    press('Scrap')

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(mutations).toHaveLength(0)
  })

  test('a refusal stays on the dialog, in the words the server chose', async () => {
    await renderAs(ME, listing({ pilots: [MY_PILOT] }))
    press('Offer to the crew')
    mutationError = new ConvexError('A build in your My Stuff is already yours')

    await confirmWith('Offer to the crew')
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe('A build in your My Stuff is already yours')
  })

  test('any other failure stays on the dialog with a plain reason, never the raw error', async () => {
    await renderAs({ ...ME, _id: 'u-med' }, listing({ crawlers: [CRAWLER] }))
    press('Scrap')
    mutationError = new Error('[CONVEX M(entities:removeCrawler)] Server Error')

    await confirmWith('Scrap')
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe(
      '#430 Tenacity could not be scrapped. Try again.'
    )
  })
})

describe('remove from game', () => {
  /** This browser holds the copy a move is made on — `ShelfSync` brings it in. */
  async function holdLocally(): Promise<void> {
    setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
    await useEntityStore
      .getState()
      .adopt('pilot', pilotFixture({ id: 'a-mine', name: 'Roach-Boy', gameId: 'g1' }))
  }
  const gameIdOf = (id: string) => useEntityStore.getState().get('pilot', id)?.gameId

  test('is offered on your own pilot once its copy is here, and on nobody else’s', async () => {
    await renderAs(ME, listing({ pilots: [MY_PILOT, THEIR_PILOT, PRE_GEN] }))
    // Not yet in this browser: nothing to move from here.
    expect(screen.queryByRole('button', { name: 'Remove from game' })).toBeNull()

    cleanup()
    await holdLocally()
    await renderAs(ME, listing({ pilots: [MY_PILOT, THEIR_PILOT, PRE_GEN] }))
    expect(screen.getAllByRole('button', { name: 'Remove from game' })).toHaveLength(1)
  })

  test('asks first — naming the game and the assignments it clears — and moves nothing until confirmed', async () => {
    await holdLocally()
    await renderAs(ME, listing({ pilots: [MY_PILOT] }))
    const dialog = press('Remove from game')

    expect(dialog.textContent).toContain('Take Roach-Boy out of Tenacity?')
    expect(dialog.textContent).toContain('goes back to My Stuff')
    expect(dialog.textContent).toContain('Their crawler assignment in Tenacity is cleared')
    expect(gameIdOf('a-mine')).toBe('g1')

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(gameIdOf('a-mine')).toBe('g1')
  })

  test('confirming moves the same record to My Stuff', async () => {
    await holdLocally()
    await renderAs(ME, listing({ pilots: [MY_PILOT] }))
    press('Remove from game')

    await confirmWith('Move to My Stuff')
    // The move writes through IndexedDB, which outlasts one act() scope.
    await settle(() => screen.queryByRole('alertdialog') === null)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    // A move, never a copy: same id, `gameId` cleared.
    expect(gameIdOf('a-mine')).toBeNull()
  })

  test('a crawler comes out at the table runner’s hand only', async () => {
    setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
    await useEntityStore
      .getState()
      .adopt('crawler', crawlerFixture({ id: 'a-crawler', name: '#430 Tenacity', gameId: 'g1' }))

    await renderAs(ME, listing({ crawlers: [CRAWLER] }))
    expect(screen.queryByRole('button', { name: 'Remove from game' })).toBeNull()

    cleanup()
    await renderAs({ ...ME, _id: 'u-med' }, listing({ crawlers: [CRAWLER] }))
    const dialog = press('Remove from game')
    expect(dialog.textContent).toContain('Everyone in Tenacity assigned to it is unassigned')
  })
})

afterAll(convexMocks.restore)
