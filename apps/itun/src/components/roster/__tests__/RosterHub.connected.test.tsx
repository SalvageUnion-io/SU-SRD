import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'

/**
 * Shelves at `/` and a Game's page at `/games/:id`, signed in, end to end
 * through the real `Roster` (issue 1279, board S1; issue 1255).
 *
 * What these pin:
 *
 *  - Shelves lists everything you keep: a unit in a Game stays on your shelf
 *    under Everything, with the Game's name in a chip, and leaves it under
 *    Not in a Game
 *  - a crawler in a Game you mediate says so
 *  - "Move to a Game…" moves the same record into a Game, and back out again
 *    behind a confirm; it never copies
 *  - a pattern's chips say who can see it and how often it has been built
 *  - a Game's page carries "+ New game" and the "Showing" select, which lists
 *    Shelves and then every Game, and shows that Game's roster, yours first
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
      convexClient: {
        mutation: async (ref: unknown, args: Record<string, unknown>) => {
          serverWrites.push({ name: getFunctionName(ref as FunctionReference<'mutation'>), args })
          // `upsertByAppId` answers with the row's new version.
          return { updatedAt: 1 }
        },
      },
    }),
  },
})

const { Roster } = await import('../Roster')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')
const { hydrateStores } = await import('../../__tests__/hydrateStores')
const { useEntityStore } = await import('../../../stores/entityStore')
const { usePatternStore } = await import('../../../stores/patternStore')
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
    // The Invited banner (ADR-039); none addressed to this viewer.
    'invites:forMe': [],
    'shelf:patternSharing': [],
    ...over,
  }
}

beforeAll(hydrateStores)

beforeEach(async () => {
  serverWrites.length = 0
  db._resetDbSingleton()
  await db.clearCache()
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: true, mechs: true, crawlers: true, npcs: true, softLinks: true },
  })
  usePatternStore.setState({ mechPatterns: [], hydrated: true })
  // On the shelf: a pilot and a crawler, cached where a signed-in roster is.
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
  await db.clearCache()
  useEntityStore.setState({ pilots: [], mechs: [], crawlers: [], softLinks: [] })
  usePatternStore.setState({ mechPatterns: [], hydrated: false })
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

async function settle(done: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !done(); i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
  }
}

const pressed = (name: string) =>
  within(screen.getByRole('group', { name: 'Showing' }))
    .getByRole('button', { name })
    .getAttribute('aria-pressed')

describe('Shelves: everything you keep', () => {
  test('a unit in a Game stays on the shelf under Everything, named by its Game', async () => {
    await useEntityStore
      .getState()
      .adopt('pilot', pilotFixture({ id: 'p-game', name: 'Roach-Boy', gameId: 'g1' }))
    await renderHub()

    expect(pressed('Everything')).toBe('true')
    const pilots = screen.getByRole('region', { name: 'Pilots' })
    expect(within(pilots).getByText('Roach-Boy')).toBeTruthy()
    expect(within(pilots).getByText('Union Crawler #430')).toBeTruthy()
    expect(within(pilots).getByText('Mira Cole')).toBeTruthy()
    expect(within(pilots).getByText('Not in a Game')).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Not in a Game' }))
    })
    expect(pressed('Not in a Game')).toBe('true')
    expect(within(pilots).queryByText('Roach-Boy')).toBeNull()
    expect(within(pilots).getByText('Mira Cole')).toBeTruthy()
  })

  test('a crawler in a Game you mediate says so', async () => {
    await useEntityStore
      .getState()
      .adopt('crawler', crawlerFixture({ id: 'c-g2', name: 'Long Hauler', gameId: 'g2' }))
    await renderHub()

    const crawlers = screen.getByRole('region', { name: 'Crawlers' })
    expect(within(crawlers).getByText('The Long Haul')).toBeTruthy()
    expect(within(crawlers).getByText('You mediate')).toBeTruthy()
  })

  test('a pattern says who can see it and how often it has been built', async () => {
    await usePatternStore.getState().adopt({
      id: 'pat-tow-rig',
      schemaVersion: 1,
      name: 'Tow Rig',
      chassisRef: 'scrapper',
      systems: [],
      modules: [],
      cargoLots: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    setQueryAnswers(
      answers({
        'shelf:patternSharing': [
          { appId: 'pat-tow-rig', visibility: 'link', gameName: null, builtCount: 2 },
        ],
      })
    )
    await renderHub()

    const patterns = screen.getByRole('region', { name: 'Patterns' })
    expect(within(patterns).getByText('“Tow Rig”')).toBeTruthy()
    expect(within(patterns).getByText('Shared by link')).toBeTruthy()
    expect(within(patterns).getByText('Built twice')).toBeTruthy()
  })
})

describe('Move to a Game…', () => {
  async function moveMira(to: string) {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'More for Mira Cole' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Move to a Game…' }))
    })
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('list', { name: 'Where to' })).getByRole('button', { name: to })
      )
    })
  }

  test('moves the same pilot into a Game, with no confirm — and it stays on the shelf', async () => {
    await renderHub()
    await moveMira('Union Crawler #430')
    await settle(() => useEntityStore.getState().get('pilot', 'p-shelf')?.gameId === 'g1')

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(useEntityStore.getState().get('pilot', 'p-shelf')?.gameId).toBe('g1')
    expect(useEntityStore.getState().list('pilot')).toHaveLength(1)
    expect(serverWrites.find((w) => w.args.appId === 'p-shelf')?.args).toMatchObject({
      gameId: 'g1',
    })
    // Still on the shelf, now named by its Game.
    const pilots = screen.getByRole('region', { name: 'Pilots' })
    expect(within(pilots).getByText('Mira Cole')).toBeTruthy()
    expect(within(pilots).getByText('Union Crawler #430')).toBeTruthy()
  })

  test('and back out, behind a confirm', async () => {
    await useEntityStore
      .getState()
      .adopt('pilot', pilotFixture({ id: 'p-shelf', name: 'Mira Cole', gameId: 'g1' }))
    await renderHub()
    await moveMira('Not in a Game')

    const dialog = screen.getByRole('alertdialog')
    expect(useEntityStore.getState().get('pilot', 'p-shelf')?.gameId).toBe('g1')
    await act(async () => {
      fireEvent.click(within(dialog).getAllByRole('button').at(-1) as HTMLElement)
    })
    await settle(() => useEntityStore.getState().get('pilot', 'p-shelf')?.gameId === null)

    expect(useEntityStore.getState().get('pilot', 'p-shelf')?.gameId).toBeNull()
  })
})

describe('a Game’s page', () => {
  const showing = () => screen.getByLabelText('Showing') as HTMLSelectElement

  test('"+ New game" and "Showing", which lists Shelves and then every Game', async () => {
    setActiveContainer({ kind: 'game', gameId: 'g1' })
    await renderHub()

    expect(screen.getByRole('button', { name: '+ New game' })).toBeTruthy()
    expect([...showing().options].map((o) => o.textContent)).toEqual([
      'Shelves',
      'Union Crawler #430',
      'The Long Haul',
    ])
    expect(showing().value).toBe('game:g1')
  })

  test('shows that Game’s roster, yours first, then the Game section', async () => {
    setActiveContainer({ kind: 'game', gameId: 'g1' })
    await renderHub()

    expect(getActiveContainer()).toEqual({ kind: 'game', gameId: 'g1' })
    // The shelf's rows are not this Game's.
    expect(screen.queryByText('Mira Cole')).toBeNull()
    expect(within(screen.getByRole('list', { name: 'Yours' })).getByText('Roach-Boy')).toBeTruthy()
    expect(
      within(screen.getByRole('list', { name: 'Everyone else' })).getByText('Ash')
    ).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Game' })).toBeTruthy()
    // A player, not the Mediator: no Mediator section.
    expect(screen.queryByRole('region', { name: 'Mediator' })).toBeNull()
  })

  test('picking Shelves in "Showing" goes back to the shelf', async () => {
    setActiveContainer({ kind: 'game', gameId: 'g1' })
    await renderHub()
    await act(async () => {
      fireEvent.change(showing(), { target: { value: 'shelf' } })
    })

    expect(getActiveContainer()).toEqual({ kind: 'shelf' })
    expect(screen.getByRole('heading', { level: 1, name: 'Shelves' })).toBeTruthy()
  })
})
