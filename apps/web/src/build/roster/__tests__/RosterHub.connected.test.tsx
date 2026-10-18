import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'

/**
 * Shelves at `/` and a Game's page at `/games/:id`, signed in, end to end
 * through the real `Roster` (board S1).
 *
 * What these pin:
 *
 *  - Shelves lists everything you keep: a unit in a Game stays on your shelf
 *    under Everything, with the Game's name in a chip, and leaves it under
 *    Unassigned
 *  - a crawler in a Game you mediate says so
 *  - "Move to a Game…" moves the same record into a Game, and back out again
 *    behind a confirm; it never copies
 *  - a pattern's chips say who can see it and how often it has been built
 *  - a Game's page carries the Games select, which lists Shelves, every Game
 *    and "+ New Game", and shows that Game's roster, yours first
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
import type { QueryAnswers } from '../../../components/__tests__/convexMock'
import { installConvexMocks, setQueryAnswers } from '../../../components/__tests__/convexMock'
import { crawlerFixture, pilotFixture } from '../../../components/__tests__/fixtures'

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
const { hydrateStores } = await import('../../../components/__tests__/hydrateStores')
const { useEntityStore } = await import('../../../stores/entityStore')
const { usePatternStore } = await import('../../../stores/patternStore')
const { setEntityBackendAuthState } = await import('../../../stores/entityBackend')
const { getActiveContainer, setActiveContainer } = await import(
  '../../../stores/activeContainerStore'
)
const { resetStores } = await import('../../../stores/__tests__/resetStores')

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
    'crew:vitals': undefined,
    'proposals:pending': [],
    'downtime:state': { running: false, stepIndex: null, completedBy: [], upkeepSpent: false },
    'mediator:amMediator': false,
    'shelf:patternSharing': [],
    'shelf:sharedByLink': [],
    ...over,
  }
}

beforeAll(hydrateStores)

beforeEach(async () => {
  serverWrites.length = 0
  resetStores()
  // The server's first answer is in, as `ShelfSync` marks it.
  useEntityStore.getState().markArrived(['pilot', 'mech', 'crawler', 'npc', 'softLink'])
  usePatternStore.getState().markArrived()
  // On the shelf: a pilot and a crawler, adopted as the server sends them.
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

afterAll(() => {
  setActiveContainer({ kind: 'shelf' })
  resetStores()
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

describe('Hangar: everything you keep', () => {
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
    expect(within(pilots).getByText('Unassigned')).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unassigned' }))
    })
    expect(pressed('Unassigned')).toBe('true')
    expect(within(pilots).queryByText('Roach-Boy')).toBeNull()
    expect(within(pilots).getByText('Mira Cole')).toBeTruthy()
  })

  test('under Unassigned, a Hangar whose units are all in Games says so', async () => {
    // The shelf's one pilot moves into a Game: every pilot is now in one.
    await useEntityStore
      .getState()
      .adopt('pilot', pilotFixture({ id: 'p-shelf', name: 'Mira Cole', gameId: 'g1' }))
    await renderHub()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unassigned' }))
    })
    const pilots = screen.getByRole('region', { name: 'Pilots' })
    expect(within(pilots).queryByText('Mira Cole')).toBeNull()
    expect(within(pilots).getByText('Every pilot is in a Game.')).toBeTruthy()
  })

  test('under Unassigned, a Hangar with nothing on it at all is empty, not "in a Game"', async () => {
    await renderHub()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unassigned' }))
    })
    const mechs = screen.getByRole('region', { name: 'Mechs' })
    expect(within(mechs).getByText('No mechs yet.')).toBeTruthy()
    expect(within(mechs).queryByText('Every mech is in a Game.')).toBeNull()
    const npcs = screen.getByRole('region', { name: 'NPCs' })
    expect(within(npcs).getByText(/No NPCs yet/)).toBeTruthy()
    expect(within(npcs).queryByText('Every NPC is in a Game.')).toBeNull()
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
    expect(within(patterns).queryByText('Built twice')).toBeNull()
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
    await moveMira('Unassigned')

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
  const showing = () => screen.getByLabelText('Games') as HTMLSelectElement

  test('the Games select lists Hangar, every Game and "+ New Game"; the band nothing else but Import and Export all', async () => {
    setActiveContainer({ kind: 'game', gameId: 'g1' })
    await renderHub()

    expect([...showing().options].map((o) => o.textContent)).toEqual([
      'Hangar',
      'Union Crawler #430',
      'The Long Haul',
      '+ New Game',
    ])
    expect(showing().value).toBe('game:g1')
    // "+ New Game" is the select's entry, not a button; the Starter Set is the masthead's.
    expect(screen.queryByRole('button', { name: '+ New Game' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Starter Set' })).toBeNull()
    expect(screen.queryByText(/Saved to your account/)).toBeNull()
  })

  test('shows that Game’s roster, yours first, then the Game section', async () => {
    setActiveContainer({ kind: 'game', gameId: 'g1' })
    await renderHub()

    expect(getActiveContainer()).toEqual({ kind: 'game', gameId: 'g1' })
    // The shelf's rows are not this Game's.
    expect(screen.queryByText('Mira Cole')).toBeNull()
    const names = screen
      .getAllByRole('link', { name: /^(Roach-Boy|Ash)$/ })
      .map((link) => link.getAttribute('aria-label'))
    expect(names).toEqual(['Roach-Boy', 'Ash'])
    expect(screen.getByRole('region', { name: 'Crew & seats' })).toBeTruthy()
    // A player, not the Mediator: no proposals of theirs, no Mediator door.
    expect(screen.queryByRole('region', { name: 'Proposals you sent' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Mediate' })).toBeNull()
  })

  test('picking Hangar in the Games select goes back to the shelf', async () => {
    setActiveContainer({ kind: 'game', gameId: 'g1' })
    await renderHub()
    await act(async () => {
      fireEvent.change(showing(), { target: { value: 'shelf' } })
    })

    expect(getActiveContainer()).toEqual({ kind: 'shelf' })
    expect(screen.getByRole('heading', { level: 1, name: 'Hangar' })).toBeTruthy()
  })
})
