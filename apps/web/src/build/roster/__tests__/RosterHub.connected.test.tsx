import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'

/**
 * The Training Bay at `/`, signed in, end to end through the real `Roster`.
 *
 * What these pin:
 *
 *  - the Training Bay lists everything you own: a unit in a Game stays in it under
 *    Everything, with a `GAME | name` relation chip opening the Game's page in
 *    Play, and leaves it under Not in a Game; a unit in no Game has no Game
 *    chip at all; one Game's entry shows that Game's units alone
 *  - a crawler in a Game you mediate says so
 *  - "Move to a Game…" moves the same record into a Game, and back out again
 *    behind a confirm; it never copies
 *  - a pattern's chips say who can see it and how often it has been built
 *  - the Training Bay is never a Game's page, and has no New Game: both are Play's
 *
 * The finer rules each have their own file: `GameRoster.connected` (rows and
 * their verbs), `GameHub.connected` (sections by role), `NewGameControl.connected`
 * (create / template), `ContainerControls` (the move rules), and
 * `Roster.test` (the signed-out hub, which has no game UI at all).
 *
 * Queries are answered **by name** (`getFunctionName`) — see `convexMock.ts`.
 */

import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'
import type { QueryAnswers } from '../../../components/__tests__/convexMock'
import { installConvexMocks, setQueryAnswers } from '../../../components/__tests__/convexMock'
import { crawlerFixture, pilotFixture } from '../../../components/__tests__/fixtures'
import { closeRooms, serve } from '../../../replica/__tests__/fakeRooms'

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
const { SyncProvider } = await import('../../../replica/SyncProvider')
const { hydrateStores } = await import('../../../components/__tests__/hydrateStores')
const { useUnits } = await import('../../../replica/units')
const { usePatterns } = await import('../../../replica/collections')
const { resetSync, setSyncStatus } = await import('../../../replica/sync')
const { resetStores } = await import('../../../replica/__tests__/resetStores')

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
    'ops:pending': [],
    'downtime:state': { running: false, stepIndex: null, completedBy: [], upkeepSpent: false },
    'mediator:amMediator': false,
    'shelf:sharedByLink': [],
    ...over,
  }
}

beforeAll(hydrateStores)

beforeEach(async () => {
  serverWrites.length = 0
  resetStores()
  // The server's first answer is in, as `ConvexFeed` marks it.
  useUnits.getState().markArrived(['pilot', 'mech', 'crawler', 'npc', 'softLink'])
  usePatterns.getState().markArrived()
  // In the Training Bay: a pilot and a crawler, adopted as the server sends them.
  setSyncStatus('live')
  await useUnits
    .getState()
    .adopt('pilot', pilotFixture({ id: 'p-shelf', name: 'Mira Cole', gameId: null }))
  await useUnits
    .getState()
    .adopt('crawler', crawlerFixture({ id: 'c-shelf', name: 'Old Hulk', gameId: null }))
  setQueryAnswers(answers())
})

afterEach(() => {
  // Process-global: a leaked signed-in state changes what later files exercise.
  resetSync()
  closeRooms()
})

afterAll(() => {
  resetStores()
  convexMocks.restore()
})

async function renderHub(): Promise<void> {
  await act(async () => {
    render(
      <SyncProvider>
        <Roster />
      </SyncProvider>
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

const showing = () => screen.getByLabelText('Showing') as HTMLSelectElement

async function show(value: string): Promise<void> {
  await act(async () => {
    fireEvent.change(showing(), { target: { value } })
  })
}

describe('Training Bay: everything you own', () => {
  test('the Showing select offers Everything, Not in a Game, then each Game', async () => {
    await renderHub()
    expect(showing().value).toBe('everything')
    expect([...showing().options].map((o) => o.textContent)).toEqual([
      'Everything',
      'Not in a Game',
      'Union Crawler #430',
      'The Long Haul',
    ])
  })

  test('a unit in a Game stays under Everything, its Game a relation chip that opens it in Play', async () => {
    await useUnits
      .getState()
      .adopt('pilot', pilotFixture({ id: 'p-game', name: 'Roach-Boy', gameId: 'g1' }))
    await renderHub()

    const pilots = screen.getByRole('region', { name: 'Pilots' })
    expect(within(pilots).getByText('Roach-Boy')).toBeTruthy()
    expect(within(pilots).getByText('Mira Cole')).toBeTruthy()
    const games = pilots.querySelectorAll('[data-chip-class="relation"] a[data-tag]')
    expect([...games].map((chip) => [chip.textContent, chip.getAttribute('href')])).toEqual([
      ['GameUnion Crawler #430', '/play/games/g1'],
    ])
    // A unit in no Game leaves the lane empty: never "Unassigned".
    expect(within(pilots).queryByText('Unassigned')).toBeNull()

    await show('not-in-game')
    expect(showing().value).toBe('not-in-game')
    expect(within(pilots).queryByText('Roach-Boy')).toBeNull()
    expect(within(pilots).getByText('Mira Cole')).toBeTruthy()
  })

  test('one Game’s entry shows that Game’s units alone', async () => {
    await useUnits
      .getState()
      .adopt('pilot', pilotFixture({ id: 'p-game', name: 'Roach-Boy', gameId: 'g1' }))
    await renderHub()

    await show('game:g1')
    const pilots = screen.getByRole('region', { name: 'Pilots' })
    expect(within(pilots).getByText('Roach-Boy')).toBeTruthy()
    expect(within(pilots).queryByText('Mira Cole')).toBeNull()
    const crawlers = screen.getByRole('region', { name: 'Crawlers' })
    expect(within(crawlers).getByText('No crawler of yours is in this Game.')).toBeTruthy()
  })

  test('under Not in a Game, a Training Bay whose units are all in Games says so', async () => {
    // The Training Bay's one pilot moves into a Game: every pilot is now in one.
    await useUnits
      .getState()
      .adopt('pilot', pilotFixture({ id: 'p-shelf', name: 'Mira Cole', gameId: 'g1' }))
    await renderHub()

    await show('not-in-game')
    const pilots = screen.getByRole('region', { name: 'Pilots' })
    expect(within(pilots).queryByText('Mira Cole')).toBeNull()
    expect(within(pilots).getByText('Every pilot is in a Game.')).toBeTruthy()
  })

  test('under Not in a Game, a Training Bay with nothing in it at all is empty, not "in a Game"', async () => {
    await renderHub()

    await show('not-in-game')
    const mechs = screen.getByRole('region', { name: 'Mechs' })
    expect(within(mechs).getByText('No mechs yet.')).toBeTruthy()
    expect(within(mechs).queryByText('Every mech is in a Game.')).toBeNull()
    const npcs = screen.getByRole('region', { name: 'NPCs' })
    expect(within(npcs).getByText(/No NPCs yet/)).toBeTruthy()
    expect(within(npcs).queryByText('Every NPC is in a Game.')).toBeNull()
  })

  test('a crawler in a Game you mediate says so', async () => {
    await useUnits
      .getState()
      .adopt('crawler', crawlerFixture({ id: 'c-g2', name: 'Long Hauler', gameId: 'g2' }))
    await renderHub()

    const crawlers = screen.getByRole('region', { name: 'Crawlers' })
    expect(within(crawlers).getByText('The Long Haul')).toBeTruthy()
    expect(within(crawlers).getByText('You mediate')).toBeTruthy()
  })

  test('a pattern says who can see it and how often it has been built', async () => {
    await usePatterns.getState().adopt({
      id: 'pat-tow-rig',
      schemaVersion: 1,
      name: 'Tow Rig',
      chassisRef: 'scrapper',
      systems: [],
      modules: [],
      cargoLots: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    // Who may see each pattern is the account room's.
    serve(null, {
      sharing: [{ appId: 'pat-tow-rig', visibility: 'link', gameName: null, builtCount: 2 }],
    })
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

  test('moves the same pilot into a Game, with no confirm — and it stays in the Training Bay', async () => {
    await renderHub()
    await moveMira('Union Crawler #430')
    await settle(() => useUnits.getState().get('pilot', 'p-shelf')?.gameId === 'g1')

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(useUnits.getState().get('pilot', 'p-shelf')?.gameId).toBe('g1')
    expect(useUnits.getState().list('pilot')).toHaveLength(1)
    expect(serverWrites.find((w) => w.name === 'ops:apply')?.args).toMatchObject({
      gameId: 'g1',
      op: { unitId: 'p-shelf', patch: { gameId: 'g1' } },
    })
    // Still in the Training Bay, now named by its Game.
    const pilots = screen.getByRole('region', { name: 'Pilots' })
    expect(within(pilots).getByText('Mira Cole')).toBeTruthy()
    expect(within(pilots).getByText('Union Crawler #430')).toBeTruthy()
  })

  test('and back out, behind a confirm', async () => {
    await useUnits
      .getState()
      .adopt('pilot', pilotFixture({ id: 'p-shelf', name: 'Mira Cole', gameId: 'g1' }))
    await renderHub()
    await moveMira('Not in a Game')

    const dialog = screen.getByRole('alertdialog')
    expect(useUnits.getState().get('pilot', 'p-shelf')?.gameId).toBe('g1')
    await act(async () => {
      fireEvent.click(within(dialog).getAllByRole('button').at(-1) as HTMLElement)
    })
    await settle(() => useUnits.getState().get('pilot', 'p-shelf')?.gameId === null)

    expect(useUnits.getState().get('pilot', 'p-shelf')?.gameId).toBeNull()
  })
})

describe('a Game’s page is Play’s, not Build’s (ADR-052 §5)', () => {
  test('the Training Bay never shows a Game, and offers no New Game', async () => {
    await renderHub()
    expect(screen.getByRole('heading', { level: 1, name: 'Training Bay' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Crew & seats' })).toBeNull()
    expect(screen.queryByRole('button', { name: '+ New Game' })).toBeNull()
  })
})
