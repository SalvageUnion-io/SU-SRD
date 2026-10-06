import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ConvexError } from 'convex/values'

/**
 * `GameRoster` — the crew roster, connected.
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
 * And, for every verb that changes who has a build — pick up, offer, copy,
 * delete, scrap — that it asks first: nothing reaches the server until the
 * confirm is pressed, Cancel leaves everything as it was, and a failure keeps
 * the dialog open with a reason.
 *
 * Queries are answered **by name** (`getFunctionName`) — see `convexMock.ts`.
 * This component asks for: account.me, games.members, entities.listForGame.
 * Mutations are recorded by name the same way.
 */

import { getFunctionName } from 'convex/server'
import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'
import { pilotFixture } from '../../__tests__/fixtures'

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
    render(<GameRoster gameId="g1" gameName="Tenacity" />)
  })
}

describe('what a row offers', () => {
  test('your own pilot offers the editable sheet', async () => {
    await renderAs(ME, listing({ pilots: [MY_PILOT] }))
    expect(screen.getByText('Roach-Boy')).toBeTruthy()
    // Edit, not View: View is the read-only crew sheet every row carries, and
    // the editable one is the extra verb ownership buys.
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
  })

  test('your own mech also offers the Dashboard', async () => {
    await renderAs(ME, listing({ mechs: [MY_MECH] }))
    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeTruthy()
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

  test("a crewmate's pilot names its holder and opens READ-ONLY", async () => {
    await renderAs(ME, listing({ pilots: [THEIR_PILOT] }))

    expect(screen.getByText('Ash')).toBeTruthy()
    // The seal names who holds it — the row's one ownership mark.
    expect(screen.getByText('Mediator')).toBeTruthy()
    // Readable: a shared table whose crew you cannot look at is not shared.
    // The link goes to the frozen crew sheet, addressed by the SERVER id.
    const view = screen.getByRole('link', { name: /^View / })
    expect(view.getAttribute('href')).toBe('/games/g1/view/pilot/s-theirs')
    // But not editable — that would hand over an editor the server refuses.
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
  test('a player with no crawler is told why they cannot add crew', async () => {
    await renderAs(ME, listing())

    // Said twice on purpose: once as the reason creation is unavailable, once
    // as the Crawlers column's own empty state.
    expect(screen.getAllByText(/no Union Crawler yet/i).length).toBeGreaterThan(0)
    // Refusing without explaining reads as a broken screen.
    expect(screen.queryByText('Create Pilot')).toBeNull()
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

  test('only the table runner may scrap a crawler', async () => {
    await renderAs(ME, listing({ crawlers: [CRAWLER] }))
    expect(screen.queryByRole('button', { name: 'Scrap' })).toBeNull()

    cleanup()
    await renderAs({ ...ME, _id: 'u-med' }, listing({ crawlers: [CRAWLER] }))
    expect(screen.getByRole('button', { name: 'Scrap' })).toBeTruthy()
  })

  test('the crawler opens for every member — that is what communal means', async () => {
    await renderAs(ME, listing({ crawlers: [CRAWLER] }))

    expect(screen.getByText('#430 Tenacity')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
    // It has no owner at all, so it carries no ownership seal — neither a
    // claim invitation nor a holder's name. "Who owns the crawler" is not a
    // question the game asks.
    expect(screen.queryByRole('button', { name: /Unclaimed/i })).toBeNull()
  })
})

describe('copy to shelf', () => {
  test('every character offers it, including ones you do not own', async () => {
    await renderAs(ME, listing({ pilots: [MY_PILOT, THEIR_PILOT, PRE_GEN] }))

    // Derived from what you may already read: membership grants the frozen crew
    // view of every row, so copying what is on screen escalates nothing. It is
    // also the only way to keep a character when you walk away from the table:
    // releasing one leaves it behind, unclaimed.
    expect(screen.getAllByRole('button', { name: 'Copy to shelf' })).toHaveLength(3)
  })

  test('the crawler does not — a deliberate hold, no longer an impossibility', async () => {
    await renderAs(ME, listing({ crawlers: [CRAWLER] }))

    // This assertion is unchanged but its reason is not. A shelved crawler was
    // once unrepresentable (`crawlers.gameId` was non-nullable); it is ordinary
    // now. The crawler is the crew's shared home rather than a character
    // somebody keeps, so offering "copy the table's crawler to your shelf" is a
    // product decision that has not been made — and this test is what will fail
    // first, loudly and in the right place, when somebody makes it.
    expect(screen.queryByRole('button', { name: 'Copy to shelf' })).toBeNull()
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

  test('Copy to shelf says the copy is separate, and copies nothing until confirmed', async () => {
    // Signed out, so the copy's create stays in the in-memory backend: this
    // file's Convex client is a stub with no `mutation`, and the backend's auth
    // state is process-global, so another file can leave it signed in.
    setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
    await renderAs(ME, listing({ pilots: [WHOLE_PILOT] }))
    const dialog = press('Copy to shelf')

    expect(dialog.textContent).toContain('Copy Vex Arlo to My stuff?')
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
    ['Copy to shelf', MY_PILOT],
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
    mutationError = new ConvexError('A build on your shelf is already yours')

    await confirmWith('Offer to the crew')
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe('A build on your shelf is already yours')
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

afterAll(convexMocks.restore)
