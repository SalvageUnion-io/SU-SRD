import { afterAll, afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

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
 * Queries are answered in **call order** — the generated `api` is a Proxy that
 * throws when inspected, so position is the only stable key. This component
 * asks for: account.me, games.members, entities.listForGame.
 */

let queryQueue: unknown[] = []
let queryIndex = 0

const realConvexClient = { ...(await import('../../../lib/connection/convexClient')) }
const realConvexReact = { ...(await import('convex/react')) }

mock.module('../../../lib/connection/convexClient', () => ({
  isConvexConfigured: true,
  convexClient: {},
}))

mock.module('convex/react', () => ({
  useQuery: () => {
    const value = queryQueue[queryIndex]
    queryIndex += 1
    return value
  },
  useMutation: () => async () => undefined,
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  ConvexReactClient: class {},
  ConvexProvider: ({ children }: { children: unknown }) => children,
  ConvexProviderWithAuth: ({ children }: { children: unknown }) => children,
  useConvex: () => ({}),
  useAction: () => async () => undefined,
}))

const { GameRoster } = await import('../GameRoster')

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

function listing(over: Record<string, unknown> = {}) {
  return { pilots: [], mechs: [], crawlers: [], softLinks: [], ...over }
}

/** Render as `viewer`, against one crew listing. */
function renderAs(me: unknown, rows: ReturnType<typeof listing>, members: unknown = MEMBERS): void {
  queryQueue = [me, members, rows]
  queryIndex = 0
  render(<GameRoster gameId="g1" gameName="Tenacity" />)
}

afterEach(cleanup)

describe('what a row offers', () => {
  test('your own pilot offers the editable sheet', () => {
    renderAs(ME, listing({ pilots: [MY_PILOT] }))
    expect(screen.getByText('Roach-Boy')).toBeTruthy()
    // Edit, not View: View is the read-only crew sheet every row carries, and
    // the editable one is the extra verb ownership buys.
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
  })

  test('your own mech also offers the Dashboard', () => {
    renderAs(ME, listing({ mechs: [MY_MECH] }))
    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeTruthy()
  })

  test('what you own can be handed back to the crew', () => {
    renderAs(ME, listing({ pilots: [MY_PILOT] }))
    // Ownership is voluntary outward (ADR-030 §4), and the pick-up confirm
    // promises this as the way back out — so it cannot be Mediator-only.
    expect(screen.getByRole('button', { name: 'Offer to the crew' })).toBeTruthy()
  })

  test("but a crewmate's cannot", () => {
    renderAs(ME, listing({ pilots: [THEIR_PILOT] }))
    expect(screen.queryByRole('button', { name: 'Offer to the crew' })).toBeNull()
  })

  test("a crewmate's pilot names its holder and opens READ-ONLY", () => {
    renderAs(ME, listing({ pilots: [THEIR_PILOT] }))

    expect(screen.getByText('Ash')).toBeTruthy()
    // The seal names who holds it — the row's one ownership mark.
    expect(screen.getByText('Mediator')).toBeTruthy()
    // Readable: a shared table whose crew you cannot look at is not shared.
    // The link goes to the frozen crew sheet, addressed by the SERVER id.
    const view = screen.getByRole('link', { name: 'View' })
    expect(view.getAttribute('href')).toBe('/games/g1/view/pilot/s-theirs')
    // But not editable — that would hand over an editor the server refuses.
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    // Nor is it takeable: somebody already holds it.
    expect(screen.queryByRole('button', { name: /Unclaimed/i })).toBeNull()
  })

  test('a crewmate has no delete affordance on your screen', () => {
    renderAs(ME, listing({ pilots: [THEIR_PILOT] }))

    // Game rows carry no trash at all — leaving a character you hold is
    // "Offer to the crew", and the crawler's Scrap is the table runner's.
    // Nothing here can destroy somebody else's build.
    expect(screen.queryByRole('button', { name: /Delete Ash/i })).toBeNull()
  })
})

describe('picking up what nobody holds', () => {
  test('an unclaimed pre-gen carries an UNCLAIMED seal', () => {
    renderAs(ME, listing({ pilots: [PRE_GEN] }))

    // Unclaimed is a STATE, not a blank — and the mark announcing it is the
    // same control you press to take the character.
    expect(screen.getByRole('button', { name: /Unclaimed/i })).toBeTruthy()
  })

  test('pressing the seal asks before it claims', () => {
    renderAs(ME, listing({ pilots: [PRE_GEN] }))
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
  test('a player with no crawler is told why they cannot add crew', () => {
    renderAs(ME, listing())

    // Said twice on purpose: once as the reason creation is unavailable, once
    // as the Crawlers column's own empty state.
    expect(screen.getAllByText(/no Union Crawler yet/i).length).toBeGreaterThan(0)
    // Refusing without explaining reads as a broken screen.
    expect(screen.queryByText('Create Pilot')).toBeNull()
  })

  test('and can create once the crawler exists', () => {
    renderAs(ME, listing({ crawlers: [CRAWLER] }))
    expect(screen.getByText('Create Pilot')).toBeTruthy()
  })

  test('a player is never offered the crawler CTA', () => {
    renderAs(ME, listing({ crawlers: [CRAWLER] }))
    expect(screen.queryByText('Raise a Crawler')).toBeNull()
  })

  test('the table runner may raise one before anything else exists', () => {
    const mediator = { ...ME, _id: 'u-med', displayName: 'Mediator' }
    renderAs(mediator, listing())

    expect(screen.getByText('Raise a Crawler')).toBeTruthy()
    // Exempt from the crawler gate, or a new game could never be set up.
    expect(screen.getByText('Create Pilot')).toBeTruthy()
  })

  test('only the table runner may scrap a crawler', () => {
    renderAs(ME, listing({ crawlers: [CRAWLER] }))
    expect(screen.queryByRole('button', { name: 'Scrap' })).toBeNull()

    cleanup()
    renderAs({ ...ME, _id: 'u-med' }, listing({ crawlers: [CRAWLER] }))
    expect(screen.getByRole('button', { name: 'Scrap' })).toBeTruthy()
  })

  test('the crawler opens for every member — that is what communal means', () => {
    renderAs(ME, listing({ crawlers: [CRAWLER] }))

    expect(screen.getByText('#430 Tenacity')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
    // It has no owner at all, so it carries no ownership seal — neither a
    // claim invitation nor a holder's name. "Who owns the crawler" is not a
    // question the game asks.
    expect(screen.queryByRole('button', { name: /Unclaimed/i })).toBeNull()
  })
})

afterAll(() => {
  mock.module('../../../lib/connection/convexClient', () => realConvexClient)
  mock.module('convex/react', () => realConvexReact)
})
