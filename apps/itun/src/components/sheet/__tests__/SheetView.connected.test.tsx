import { afterAll, afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createElement } from 'react'

/**
 * `SheetView` — the one way to view an entity, connected.
 *
 * The user-facing promises this pins:
 *
 *  - a crewmate's pilot shows its CURRENT assignments — the mech flying it and
 *    the crawler it crews — read from the Game's live listing, not a frozen
 *    single-entity copy that could show neither;
 *  - your own sheet opens editable, a crewmate's read-only with no edit
 *    controls, at the same address;
 *  - your crawler's crew lists crewmates' pilots this browser does not cache,
 *    as read-only rows that link to their live view;
 *  - an address the server knows by another id (the retired crew view's row
 *    id) is replaced by the canonical one.
 *
 * Queries are answered by name (`convexMock.ts`): `entities:locate` and
 * `entities:listForGame`.
 */

import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'
import { crawlerFixture, FIXTURE_NOW, mechFixture, pilotFixture } from '../../__tests__/fixtures'

/** Every `router.navigate` the view made. */
const navigations: unknown[] = []

// Module scope, before the imports below (see `convexMock.ts`). The router is
// replaced with one whose `navigate` records, so the canonical-id redirect can
// be observed without mounting a RouterProvider.
const convexMocks = await installConvexMocks({
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

const { SheetView } = await import('../SheetView')
const { ConnectionContext } = await import('../../../lib/connection/connectionContext')
const { hydrateStores } = await import('../../__tests__/hydrateStores')
const { useEntityStore } = await import('../../../stores/entityStore')

afterAll(() => convexMocks.restore())

beforeEach(async () => {
  await hydrateStores()
  navigations.length = 0
})

afterEach(() => {
  cleanup()
  useEntityStore.setState({ pilots: [], mechs: [], crawlers: [], softLinks: [] })
})

const CONNECTED = {
  mode: 'connected' as const,
  canWrite: true,
  showDisconnectedWarning: false,
  settling: false,
}

const GAME = 'g1'

const MY_PILOT = pilotFixture({ id: 'p-mine', name: 'Roach-Boy', gameId: GAME })
const THEIR_PILOT = pilotFixture({ id: 'p-theirs', name: 'Ash Vey', gameId: GAME })
const THEIR_MECH = mechFixture({ id: 'm-theirs', name: 'Iron Mongrel', gameId: GAME })
const CRAWLER = crawlerFixture({ id: 'c-home', name: '#430 Tenacity', gameId: GAME })

function link(id: string, type: 'mech-to-pilot' | 'pilot-to-crawler', from: string, to: string) {
  const [fromType, toType] = type === 'mech-to-pilot' ? ['mech', 'pilot'] : ['pilot', 'crawler']
  return {
    _id: id,
    _creationTime: 0,
    gameId: GAME,
    from: { type: fromType as 'mech' | 'pilot', id: from },
    to: { type: toType as 'pilot' | 'crawler', id: to },
    type,
  }
}

/** The Game, as `listForGame` serves it: the crewmate's pilot flies their mech and crews the crawler. */
function listing(over: Record<string, unknown> = {}) {
  return {
    pilots: [
      { _id: 'row-mine', appId: MY_PILOT.id, ownerId: 'u-me', body: MY_PILOT },
      { _id: 'row-theirs', appId: THEIR_PILOT.id, ownerId: 'u-them', body: THEIR_PILOT },
    ],
    mechs: [{ _id: 'row-mech', appId: THEIR_MECH.id, ownerId: 'u-them', body: THEIR_MECH }],
    crawlers: [{ _id: 'row-crawler', appId: CRAWLER.id, body: CRAWLER }],
    softLinks: [
      link('l1', 'mech-to-pilot', THEIR_MECH.id, THEIR_PILOT.id),
      link('l2', 'pilot-to-crawler', THEIR_PILOT.id, CRAWLER.id),
    ],
    primaryCrawlerId: 'row-crawler',
    ...over,
  }
}

async function view(kind: 'pilot' | 'mech' | 'crawler', id: string) {
  await act(async () => {
    render(
      <ConnectionContext.Provider value={CONNECTED}>
        <SheetView kind={kind} id={id} />
      </ConnectionContext.Provider>
    )
  })
}

describe("a crewmate's sheet", () => {
  test('shows its mech and crawler, read live from the Game', async () => {
    setQueryAnswers({
      'entities:locate': { id: THEIR_PILOT.id, gameId: GAME, mayEdit: false },
      'entities:listForGame': listing(),
    })
    await view('pilot', THEIR_PILOT.id)

    // The assignments the frozen crew view could never show.
    expect(screen.getByRole('link', { name: 'View Iron Mongrel' }).getAttribute('href')).toBe(
      '/sheet/mech/m-theirs'
    )
    expect(screen.getByRole('link', { name: 'View #430 Tenacity' }).getAttribute('href')).toBe(
      '/sheet/crawler/c-home'
    )
  })

  test('is read-only: the banner says why, and no edit control renders', async () => {
    setQueryAnswers({
      'entities:locate': { id: THEIR_PILOT.id, gameId: GAME, mayEdit: false },
      'entities:listForGame': listing(),
    })
    await view('pilot', THEIR_PILOT.id)

    expect(screen.getByRole('note', { name: 'Read-only crew sheet' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Share this pilot$/ })).toBeNull()
    // No unassign on a sheet that is not yours.
    expect(screen.queryByRole('button', { name: /^Unassign Iron Mongrel$/ })).toBeNull()
    // Nothing was cached: reading is not owning.
    expect(useEntityStore.getState().get('pilot', THEIR_PILOT.id)).toBeNull()
  })

  test('a local copy the server says is not yours opens read-only too', async () => {
    // A copy can outlive its ownership — offered to the crew, released by a
    // sweep. "Held here" is not "yours".
    useEntityStore.setState({ pilots: [THEIR_PILOT] })
    setQueryAnswers({
      'entities:locate': { id: THEIR_PILOT.id, gameId: GAME, mayEdit: false },
      'entities:listForGame': listing(),
    })
    await view('pilot', THEIR_PILOT.id)

    expect(screen.getByRole('note', { name: 'Read-only crew sheet' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Share this pilot$/ })).toBeNull()
  })
})

describe('your own sheet', () => {
  test('opens editable from the local store, at the same address', async () => {
    useEntityStore.setState({ pilots: [MY_PILOT] })
    setQueryAnswers({
      'entities:locate': { id: MY_PILOT.id, gameId: GAME, mayEdit: true },
      'entities:listForGame': listing(),
    })
    await view('pilot', MY_PILOT.id)

    expect(screen.queryByRole('note', { name: 'Read-only crew sheet' })).toBeNull()
    expect(screen.getByRole('button', { name: /^Share this pilot$/ })).toBeTruthy()
  })

  test("shows the crewmate's mech flying it — but leaves its unassign to them", async () => {
    useEntityStore.setState({
      pilots: [MY_PILOT],
      // WiringSync caches every link in your Games.
      softLinks: [
        {
          id: 'l3',
          type: 'mech-to-pilot',
          from: { type: 'mech', id: THEIR_MECH.id },
          to: { type: 'pilot', id: MY_PILOT.id },
          createdAt: FIXTURE_NOW,
        },
      ],
    })
    setQueryAnswers({
      'entities:locate': { id: MY_PILOT.id, gameId: GAME, mayEdit: true },
      'entities:listForGame': listing({ softLinks: [] }),
    })
    await view('pilot', MY_PILOT.id)

    expect(screen.getByRole('link', { name: 'View Iron Mongrel' })).toBeTruthy()
    // A mech link is undrawn from the mech, which is not yours.
    expect(screen.queryByRole('button', { name: /^Unassign Iron Mongrel$/ })).toBeNull()
  })

  test("your crawler lists crewmates' pilots as read-only rows to their live view", async () => {
    useEntityStore.setState({
      crawlers: [CRAWLER],
      pilots: [MY_PILOT],
      softLinks: [
        {
          id: 'l2',
          type: 'pilot-to-crawler',
          from: { type: 'pilot', id: THEIR_PILOT.id },
          to: { type: 'crawler', id: CRAWLER.id },
          createdAt: FIXTURE_NOW,
        },
        {
          id: 'l4',
          type: 'pilot-to-crawler',
          from: { type: 'pilot', id: MY_PILOT.id },
          to: { type: 'crawler', id: CRAWLER.id },
          createdAt: FIXTURE_NOW,
        },
        {
          id: 'l5',
          type: 'mech-to-crawler',
          from: { type: 'mech', id: THEIR_MECH.id },
          to: { type: 'crawler', id: CRAWLER.id },
          createdAt: FIXTURE_NOW,
        },
      ],
    })
    setQueryAnswers({
      'entities:locate': { id: CRAWLER.id, gameId: GAME, mayEdit: true },
      'entities:listForGame': listing(),
    })
    await view('crawler', CRAWLER.id)

    // Editable — the crawler is communal.
    expect(screen.getByRole('button', { name: /^Share this crawler$/ })).toBeTruthy()
    // The crewmate this browser does not cache is on the crew list…
    expect(screen.getByRole('link', { name: 'View Ash Vey' }).getAttribute('href')).toBe(
      '/sheet/pilot/p-theirs'
    )
    // …read-only: their crew link is theirs to undraw.
    expect(screen.queryByRole('button', { name: /^Unassign Ash Vey$/ })).toBeNull()
    // Your own pilot keeps its unlink.
    expect(screen.getByRole('button', { name: /^Unassign Roach-Boy$/ })).toBeTruthy()
    // A crewmate's mech docked here is in the bay too — and theirs to undock.
    expect(screen.getByRole('link', { name: 'View Iron Mongrel' }).getAttribute('href')).toBe(
      '/sheet/mech/m-theirs'
    )
    expect(screen.queryByRole('button', { name: /^Unassign Iron Mongrel$/ })).toBeNull()
  })
})

describe('the tab title', () => {
  test('names your entity and follows a rename', async () => {
    useEntityStore.setState({ pilots: [MY_PILOT] })
    setQueryAnswers({
      'entities:locate': { id: MY_PILOT.id, gameId: GAME, mayEdit: true },
      'entities:listForGame': listing(),
    })
    await view('pilot', MY_PILOT.id)
    expect(document.title).toBe('Roach-Boy · In The Union Now')

    await act(async () => {
      useEntityStore.setState({ pilots: [{ ...MY_PILOT, name: 'Roach-Man' }] })
    })
    expect(document.title).toBe('Roach-Man · In The Union Now')
  })

  test("a crewmate's sheet, not held here, keeps the generic title", async () => {
    setQueryAnswers({
      'entities:locate': { id: THEIR_PILOT.id, gameId: GAME, mayEdit: false },
      'entities:listForGame': listing(),
    })
    await view('pilot', THEIR_PILOT.id)
    expect(document.title).toBe('Sheet · In The Union Now')
  })
})

describe('addresses', () => {
  test('a row id (the retired crew view) is replaced by the canonical app id', async () => {
    setQueryAnswers({
      'entities:locate': { id: THEIR_PILOT.id, gameId: GAME, mayEdit: false },
      'entities:listForGame': listing(),
    })
    await view('pilot', 'row-theirs')

    expect(navigations).toEqual([
      { to: '/sheet/$kind/$id', params: { kind: 'pilot', id: THEIR_PILOT.id }, replace: true },
    ])
  })

  test('something you cannot see is simply not found', async () => {
    setQueryAnswers({ 'entities:locate': null })
    await view('pilot', 'stranger')

    expect(screen.getByText(/pilot not found/i)).toBeTruthy()
  })
})
