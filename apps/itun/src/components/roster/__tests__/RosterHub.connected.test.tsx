import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'

/**
 * The hub at `/`, signed in — the one place a player's builds and their Games
 * live now that the Games pages are gone.
 *
 * What these pin, end to end through the real `Roster`:
 *
 *  - the band carries "+ New game" and the "Showing" select, which lists
 *    My Stuff and then every Game (never "Shelf")
 *  - My Stuff rows each offer View, "Move to game…" and Delete
 *  - picking a Game swaps the body for that Game's roster — yours first —
 *    with the Game section below the lists; My Stuff's rows are not shown
 *  - a remembered Game (the `/games/:id` redirect, a reload) opens straight
 *    into it
 *
 * The finer rules each have their own file: `GameRoster.connected` (rows and
 * their verbs), `GameHub.connected` (sections by role), `NewGameControl.connected`
 * (create / template / join), `ContainerControls` (the move rules), and
 * `Roster.test` (the signed-out hub, which has no game UI at all).
 *
 * Queries are answered **by name** (`getFunctionName`) — see `convexMock.ts`.
 */

import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'
import type { QueryAnswers } from '../../__tests__/convexMock'
import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'
import { crawlerFixture, pilotFixture } from '../../__tests__/fixtures'

const serverWrites: { name: string; args: Record<string, unknown> }[] = []

const convexMocks = await installConvexMocks({
  also: {
    // Signed in, the store commits to Convex first; record what it sends.
    '../../lib/connection/convexClient': () => ({
      isConvexConfigured: true,
      convexClient: {
        mutation: async (ref: unknown, args: Record<string, unknown>) => {
          serverWrites.push({ name: getFunctionName(ref as FunctionReference<'mutation'>), args })
        },
      },
    }),
  },
})

const { Roster } = await import('../Roster')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')
const { hydrateStores } = await import('../../__tests__/hydrateStores')
const { useEntityStore } = await import('../../../stores/entityStore')
const { setEntityBackendAuthState } = await import('../../../stores/entityBackend')
const { getActiveContainer, setActiveContainer } = await import(
  '../../../stores/activeContainerStore'
)
const db = await import('../../../lib/db/index')

const GAMES = [
  { _id: 'g1', name: 'Union Crawler #430', mediator: false, organizer: false, tableRunner: false },
  { _id: 'g2', name: 'The Long Haul', mediator: true, organizer: true, tableRunner: true },
]

const GAME_G1 = {
  ...GAMES[0],
  templateOrigin: undefined,
  memberCount: 2,
  crawlerName: null,
  pilotCount: 2,
  mechCount: 0,
}

/** g1 as `listForGame` serves it: one pilot of mine, one of a crewmate's. */
const LISTING = {
  pilots: [
    {
      _id: 's-theirs',
      appId: 'a-theirs',
      ownerId: 'u-bly',
      body: { id: 'a-theirs', name: 'Ash' },
    },
    {
      _id: 's-mine',
      appId: 'a-mine',
      ownerId: 'u-me',
      body: { id: 'a-mine', name: 'Roach-Boy' },
    },
  ],
  mechs: [],
  crawlers: [],
  softLinks: [],
}

function answers(over: QueryAnswers = {}): QueryAnswers {
  return {
    'games:listMine': GAMES,
    'games:get': GAME_G1,
    'account:me': { _id: 'u-me', displayName: 'Me' },
    'games:members': [
      { userId: 'u-me', displayName: 'Me', mediator: false, organizer: false },
      { userId: 'u-bly', displayName: 'Bly', mediator: false, organizer: false },
    ],
    'entities:listForGame': LISTING,
    'proposals:pending': [],
    'downtime:state': { running: false, stepIndex: null, completedBy: [], upkeepSpent: false },
    'mediator:amMediator': false,
    ...over,
  }
}

beforeAll(hydrateStores)

beforeEach(async () => {
  serverWrites.length = 0
  db._resetDbSingleton()
  await db._clearAllStores()
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: true, mechs: true, crawlers: true, softLinks: true },
  })
  // My Stuff: a pilot and a crawler, cached where a signed-in roster is.
  setEntityBackendAuthState({ signedIn: true, online: true, authSettled: true })
  await useEntityStore
    .getState()
    .adopt('pilot', pilotFixture({ id: 'p-shelf', name: 'Mira Cole', gameId: null }))
  await useEntityStore
    .getState()
    .adopt('crawler', crawlerFixture({ id: 'c-shelf', name: 'Old Hulk', gameId: null }))
  setActiveContainer({ kind: 'shelf' })
  setQueryAnswers(answers())
})

afterEach(() => {
  // Process-global: a leaked signed-in state changes what later files exercise.
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
})

afterAll(async () => {
  setActiveContainer({ kind: 'shelf' })
  await db._clearAllStores()
  useEntityStore.setState({ pilots: [], mechs: [], crawlers: [], softLinks: [] })
  convexMocks.restore()
})

async function renderHub(): Promise<void> {
  await act(async () => {
    render(
      <ConnectionProvider>
        <Roster />
      </ConnectionProvider>
    )
  })
}

const showing = () => screen.getByLabelText('Showing') as HTMLSelectElement

describe('the band', () => {
  test('"+ New game" and "Showing", which lists My Stuff and then every Game', async () => {
    await renderHub()

    expect(screen.getByRole('button', { name: '+ New game' })).toBeTruthy()
    expect([...showing().options].map((o) => o.textContent)).toEqual([
      'My Stuff',
      'Union Crawler #430',
      'The Long Haul',
    ])
    expect(showing().value).toBe('shelf')
    // "Shelf" is a code word; nothing a player reads says it.
    expect(document.body.textContent?.toLowerCase()).not.toContain('shelf')
  })
})

describe('My Stuff', () => {
  test('each row offers View, "Move to game…" and Delete — moves only where its kind may go', async () => {
    await renderHub()

    expect(screen.getByRole('link', { name: 'View Mira Cole' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Delete Mira Cole/ })).toBeTruthy()
    const pilotMove = screen.getByLabelText('Move Mira Cole to a game') as HTMLSelectElement
    expect([...pilotMove.options].map((o) => o.textContent)).toEqual([
      'Move to game…',
      'Union Crawler #430',
      'The Long Haul',
    ])
    // A crawler goes only into a Game this player runs (ADR-037).
    const crawlerMove = screen.getByLabelText('Move Old Hulk to a game') as HTMLSelectElement
    expect([...crawlerMove.options].map((o) => o.textContent)).toEqual([
      'Move to game…',
      'The Long Haul',
    ])
  })

  test('moving a pilot into a Game takes it off My Stuff, with no confirm', async () => {
    await renderHub()

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Move Mira Cole to a game'), {
        target: { value: 'game:g1' },
      })
    })
    for (let i = 0; i < 100 && screen.queryByText('Mira Cole') !== null; i++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
      })
    }

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByText('Mira Cole')).toBeNull()
    expect(useEntityStore.getState().get('pilot', 'p-shelf')?.gameId).toBe('g1')
    expect(serverWrites.find((w) => w.args.appId === 'p-shelf')?.args).toMatchObject({
      gameId: 'g1',
    })
  })
})

describe('a Game picked in "Showing"', () => {
  test('swaps My Stuff for that Game: its roster, yours first, then the Game section', async () => {
    await renderHub()
    await act(async () => {
      fireEvent.change(showing(), { target: { value: 'game:g1' } })
    })

    expect(getActiveContainer()).toEqual({ kind: 'game', gameId: 'g1' })
    // My Stuff's rows are not this container's.
    expect(screen.queryByText('Mira Cole')).toBeNull()
    expect(within(screen.getByRole('list', { name: 'Yours' })).getByText('Roach-Boy')).toBeTruthy()
    expect(
      within(screen.getByRole('list', { name: 'Everyone else' })).getByText('Ash')
    ).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Game' })).toBeTruthy()
    // A player, not the Mediator: no Mediator section.
    expect(screen.queryByRole('region', { name: 'Mediator' })).toBeNull()
  })

  test('a remembered Game opens straight into it', async () => {
    setActiveContainer({ kind: 'game', gameId: 'g1' })
    await renderHub()

    expect(showing().value).toBe('game:g1')
    expect(screen.getByText('Roach-Boy')).toBeTruthy()
  })
})
