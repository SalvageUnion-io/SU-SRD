/**
 * NpcSheetView — `/npcs/:id`: which NPC, and whether the viewer may edit
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
import { installConvexMocks, setQueryAnswers } from '../../../components/__tests__/convexMock'
import { crawlerFixture, npcFixture, softLinkFixture } from '../../../components/__tests__/fixtures'
import {
  accountAnswers,
  accountApiStub,
  resetAccountApi,
} from '../../../lib/account/__tests__/accountApiStub'
import { withSignedInBackend } from '../../../replica/__tests__/signedInBackend'
import type { SyncState } from '../../../replica/syncContext'

// Module scope, before the imports below — see `convexMock.ts`.
const convexMocks = await installConvexMocks({
  router: true,
  convexClient: { mutation: async () => ({ updatedAt: 1 }) },
  also: { '../../lib/account/accountApi': accountApiStub },
})
afterAll(() => convexMocks.restore())

const { SyncContext } = await import('../../../replica/syncContext')
const { useUnits } = await import('../../../replica/units')
const { NpcSheetView } = await import('../NpcSheetView')

withSignedInBackend()

function connection(status: SyncState['status']): SyncState {
  return {
    status,
    canWrite: status === 'live',
    outdated: false,
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

/** "Made by [maker]": the band's label-first chip (`MADE BY | Sam`). */
function madeBy(name: string) {
  return screen.getByText(name, { selector: '*' })
}

/** The corner's "⋯": Move and Delete live under it, as on every sheet. */
async function openMenu() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
  })
}

async function renderView(id: string, status: SyncState['status'] = 'live') {
  await act(async () => {
    render(
      <SyncContext.Provider value={connection(status)}>
        <NpcSheetView id={id} />
      </SyncContext.Provider>
    )
  })
}

beforeEach(async () => {
  convexMocks.navigations.length = 0
  useUnits.setState({
    npcs: [],
    crawlers: [TENACITY],
    softLinks: [softLinkFixture('npc-to-crawler', 'n-mine', 'c1')],
    hydrated: { pilots: true, mechs: true, crawlers: true, npcs: true, softLinks: true },
  })
  await useUnits.getState().adopt('npc', MINE)
  setQueryAnswers({
    'games:listMine': [],
    'account:me': { displayName: 'alxjrvs' },
    'entities:locate': { id: 'n-mine', gameId: null, mayEdit: true },
  })
  resetAccountApi()
  accountAnswers.me = { displayName: 'alxjrvs' }
})

describe('yours', () => {
  test('editable, credited to you, naming the slot it crews and the page title', async () => {
    await renderView('n-mine')
    await openMenu()
    expect(screen.getByRole('button', { name: 'Delete Doc Ambrose' })).toBeTruthy()
    expect(madeBy('alxjrvs')).toBeTruthy()
    expect(screen.getByText(/Crews the Med Bay on/)).toBeTruthy()
    expect(screen.getByRole('link', { name: '#430 Tenacity' })).toBeTruthy()
    expect(document.title).toContain('Doc Ambrose')
  })

  test('held but offline, it is still yours to read', async () => {
    await renderView('n-mine', 'offline')
    expect(madeBy('you')).toBeTruthy()
  })

  test('deleting it goes back to the Training Bay', async () => {
    await renderView('n-mine')
    await openMenu()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete Doc Ambrose' }))
    })
    const dialog = await screen.findByRole('alertdialog')
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    })
    await waitFor(() => expect(convexMocks.navigations).toEqual([{ to: '/' }]))
    expect(useUnits.getState().npcs).toHaveLength(0)
  })
})

describe('a crewmate’s, in a Game you belong to', () => {
  test('read-only, credited to its maker, crewing the Game crawler', async () => {
    setQueryAnswers({
      'games:listMine': [],
      'account:me': { displayName: 'alxjrvs' },
      'entities:locate': { id: 'n-theirs', gameId: 'g1', mayEdit: false },
      'entities:listForGame': gameListing(),
      'games:members': [{ userId: 'u-sam', displayName: 'Sam' }],
    })
    await renderView('n-theirs')
    expect(madeBy('Sam')).toBeTruthy()
    // A crewmate's NPC has no corner actions and no Read | Edit to switch.
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Edit$/ })).toBeNull()
    // The crew sheet's caution banner says why, as on a crewmate's pilot.
    expect(screen.getByRole('note', { name: 'Read-only crew sheet' }).textContent).toContain(
      'You are reading a crewmate’s NPC'
    )
    expect(screen.getByRole('link', { name: 'Bulwark' })).toBeTruthy()
  })

  test('a maker who is no longer a member is "a player"', async () => {
    setQueryAnswers({
      'games:listMine': [],
      'account:me': { displayName: 'alxjrvs' },
      'entities:locate': { id: 'n-theirs', gameId: 'g1', mayEdit: false },
      'entities:listForGame': gameListing(),
      'games:members': [],
    })
    await renderView('n-theirs')
    expect(madeBy('a player')).toBeTruthy()
  })

  test('a row this app cannot read says so', async () => {
    setQueryAnswers({
      'account:me': { displayName: 'alxjrvs' },
      'entities:locate': { id: 'n-theirs', gameId: 'g1', mayEdit: false },
      'entities:listForGame': gameListing({ name: 42 }),
      'games:members': [],
    })
    await renderView('n-theirs')
    expect(screen.getByText('Could not show this NPC')).toBeTruthy()
  })

  test('while the listing loads, a skeleton', async () => {
    setQueryAnswers({
      'account:me': { displayName: 'alxjrvs' },
      'entities:locate': { id: 'n-theirs', gameId: 'g1', mayEdit: false },
      'entities:listForGame': undefined,
      'games:members': undefined,
    })
    await renderView('n-theirs')
    expect(screen.getByRole('status', { name: 'Loading the sheet…' })).toBeTruthy()
  })
})

describe('neither', () => {
  test('the server knows no such NPC', async () => {
    setQueryAnswers({ 'account:me': null, 'entities:locate': null })
    await renderView('n-missing')
    // The words every sheet's not-found uses (`SheetFallback`).
    expect(screen.getByText('NPC not found')).toBeTruthy()
    expect(screen.getByText(/This NPC may have been deleted/)).toBeTruthy()
  })

  test('still locating: a skeleton', async () => {
    setQueryAnswers({ 'account:me': undefined, 'entities:locate': undefined })
    await renderView('n-missing')
    expect(screen.getByRole('status', { name: 'Loading the sheet…' })).toBeTruthy()
  })

  test('yours on the server but not here yet: a skeleton while it arrives', async () => {
    setQueryAnswers({
      'account:me': null,
      'entities:locate': { id: 'n-missing', gameId: null, mayEdit: true },
    })
    await renderView('n-missing')
    expect(screen.getByRole('status', { name: 'Loading the sheet…' })).toBeTruthy()
  })

  test('offline and not held: loading it needs a connection', async () => {
    await renderView('n-missing', 'offline')
    expect(screen.getByText('NPC unavailable offline')).toBeTruthy()
    expect(screen.getByText(/loading it needs a connection/)).toBeTruthy()
  })

  test('still connecting: a skeleton', async () => {
    await renderView('n-missing', 'syncing')
    expect(screen.getByRole('status', { name: 'Loading the sheet…' })).toBeTruthy()
  })
})
