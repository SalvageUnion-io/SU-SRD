/**
 * NpcSheetView — `/sheet/npc/:id`: which NPC, and whether the viewer may edit
 * it (ADR-044).
 *
 * Yours (held here, and the server agrees) is editable and names the crawler
 * slot it crews; a crewmate's, in a Game you belong to, is read live from the
 * Game's listing and read-only, credited to its maker; anything else is not
 * found, or a skeleton while the answer is on its way. Deleting your own goes
 * back to the Shelves.
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ConnectionState } from '../../../lib/connection/connectionContext'
import { withSignedInBackend } from '../../../stores/__tests__/signedInBackend'
import { installConvexMocks, setQueryAnswers } from '../../../components/__tests__/convexMock'
import { crawlerFixture, npcFixture, softLinkFixture } from '../../../components/__tests__/fixtures'

// Module scope, before the imports below — see `convexMock.ts`.
const convexMocks = await installConvexMocks({
  router: true,
  convexClient: { mutation: async () => ({ updatedAt: 1 }) },
})
afterAll(() => convexMocks.restore())

const { ConnectionContext } = await import('../../../lib/connection/connectionContext')
const { useEntityStore } = await import('../../../stores/entityStore')
const { NpcSheetView } = await import('../NpcSheetView')

withSignedInBackend()

function connection(mode: ConnectionState['mode']): ConnectionState {
  return {
    mode,
    canWrite: mode === 'connected',
    showDisconnectedWarning: false,
    settling: false,
  }
}

const MINE = npcFixture({ id: 'n-mine', name: 'Doc Ambrose', position: 'Doc', gameId: null })
const THEIRS = npcFixture({ id: 'n-theirs', name: 'Rook', position: 'Gunner', gameId: 'g1' })
const TENACITY = crawlerFixture({ id: 'c1', name: '#430 Tenacity' })

/** The Game's live listing, holding a crewmate's NPC crewing its crawler's Med Bay. */
function gameListing(npcBody: unknown = THEIRS) {
  return {
    pilots: [],
    mechs: [],
    crawlers: [{ appId: 'c-game', body: { id: 'c-game', name: 'Bulwark' }, ownerId: 'u-gm' }],
    npcs: [{ appId: 'n-theirs', body: npcBody, ownerId: 'u-sam' }],
    softLinks: [
      {
        _id: 'link-1',
        _creationTime: 0,
        from: { type: 'npc', id: 'n-theirs' },
        to: { type: 'crawler', id: 'c-game' },
        type: 'npc-to-crawler',
        slot: { kind: 'bay', bayRef: 'med-bay' },
      },
    ],
    primaryCrawlerId: null,
  }
}

async function renderView(id: string, mode: ConnectionState['mode'] = 'connected') {
  await act(async () => {
    render(
      <ConnectionContext.Provider value={connection(mode)}>
        <NpcSheetView id={id} />
      </ConnectionContext.Provider>
    )
  })
}

beforeEach(async () => {
  convexMocks.navigations.length = 0
  useEntityStore.setState({
    npcs: [],
    crawlers: [TENACITY],
    softLinks: [softLinkFixture('npc-to-crawler', 'n-mine', 'c1')],
    hydrated: { pilots: true, mechs: true, crawlers: true, npcs: true, softLinks: true },
  })
  await useEntityStore.getState().adopt('npc', MINE)
  setQueryAnswers({
    'games:listMine': [],
    'account:me': { displayName: 'alxjrvs' },
    'entities:locate': { gameId: null, mayEdit: true },
  })
})

describe('yours', () => {
  test('editable, credited to you, naming the slot it crews and the page title', async () => {
    await renderView('n-mine')
    expect(screen.getByRole('button', { name: 'Delete Doc Ambrose' })).toBeTruthy()
    expect(screen.getByText('Made by alxjrvs')).toBeTruthy()
    expect(screen.getByText(/Crews the Med Bay on/)).toBeTruthy()
    expect(screen.getByRole('link', { name: '#430 Tenacity' })).toBeTruthy()
    expect(document.title).toContain('Doc Ambrose')
  })

  test('held but offline, it is still yours to read', async () => {
    await renderView('n-mine', 'disconnected')
    expect(screen.getByText('Made by you')).toBeTruthy()
  })

  test('deleting it goes back to the Hangar', async () => {
    await renderView('n-mine')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete Doc Ambrose' }))
    })
    const dialog = await screen.findByRole('alertdialog')
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    })
    await waitFor(() => expect(convexMocks.navigations).toEqual([{ to: '/' }]))
    expect(useEntityStore.getState().npcs).toHaveLength(0)
  })
})

describe('a crewmate’s, in a Game you belong to', () => {
  test('read-only, credited to its maker, crewing the Game crawler, with a way back', async () => {
    setQueryAnswers({
      'games:listMine': [],
      'account:me': { displayName: 'alxjrvs' },
      'entities:locate': { gameId: 'g1', mayEdit: false },
      'entities:listForGame': gameListing(),
      'games:members': [{ userId: 'u-sam', displayName: 'Sam' }],
    })
    await renderView('n-theirs')
    expect(screen.getByText('Made by Sam')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Delete Rook' })).toBeNull()
    expect(screen.getByText(/You are reading a crewmate’s NPC/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Bulwark' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'The crew' }).getAttribute('href')).toBe('/games/g1')
  })

  test('a maker who is no longer a member is "a player"', async () => {
    setQueryAnswers({
      'games:listMine': [],
      'account:me': { displayName: 'alxjrvs' },
      'entities:locate': { gameId: 'g1', mayEdit: false },
      'entities:listForGame': gameListing(),
      'games:members': [],
    })
    await renderView('n-theirs')
    expect(screen.getByText('Made by a player')).toBeTruthy()
  })

  test('a row this app cannot read says so', async () => {
    setQueryAnswers({
      'account:me': { displayName: 'alxjrvs' },
      'entities:locate': { gameId: 'g1', mayEdit: false },
      'entities:listForGame': gameListing({ name: 42 }),
      'games:members': [],
    })
    await renderView('n-theirs')
    expect(screen.getByText('Could not show this NPC')).toBeTruthy()
  })

  test('while the listing loads, a skeleton', async () => {
    setQueryAnswers({
      'account:me': { displayName: 'alxjrvs' },
      'entities:locate': { gameId: 'g1', mayEdit: false },
      'entities:listForGame': undefined,
      'games:members': undefined,
    })
    await renderView('n-theirs')
    expect(screen.getByRole('status', { name: 'Loading sheet' })).toBeTruthy()
  })
})

describe('neither', () => {
  test('the server knows no such NPC', async () => {
    setQueryAnswers({ 'account:me': null, 'entities:locate': null })
    await renderView('n-missing')
    expect(screen.getByText('NPC not found')).toBeTruthy()
    expect(screen.getByText(/It may have been deleted/)).toBeTruthy()
  })

  test('still locating: a skeleton', async () => {
    setQueryAnswers({ 'account:me': undefined, 'entities:locate': undefined })
    await renderView('n-missing')
    expect(screen.getByRole('status', { name: 'Loading sheet' })).toBeTruthy()
  })

  test('yours on the server but not here yet: a skeleton while it arrives', async () => {
    setQueryAnswers({ 'account:me': null, 'entities:locate': { gameId: null, mayEdit: true } })
    await renderView('n-missing')
    expect(screen.getByRole('status', { name: 'Loading sheet' })).toBeTruthy()
  })

  test('offline and not held: loading it needs a connection', async () => {
    await renderView('n-missing', 'disconnected')
    expect(screen.getByText('NPC not found')).toBeTruthy()
    expect(screen.getByText(/loading it needs a connection/)).toBeTruthy()
  })

  test('still connecting: a skeleton', async () => {
    await renderView('n-missing', 'connecting')
    expect(screen.getByRole('status', { name: 'Loading sheet' })).toBeTruthy()
  })
})
