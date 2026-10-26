/**
 * The public pattern page, `/p/pattern/:appId`: laid out as the
 * book's pattern page, plainly homebrew, and buildable by a signed-in reader.
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { acceptingRooms, roomActs } from '../../../../../test/roomsStub'
import { FIXTURE_NOW } from '../../../../components/__tests__/fixtures'
import { installServerMocks, setQueryAnswers } from '../../../../components/__tests__/serverMock'
import { answerRoutes, withWorkerRoutes } from '../../../../lib/sharing/__tests__/workerRoutes'
import { sharedPaths } from '../../../../lib/sharing/paths'
import { withSignedInBackend } from '../../../../replica/__tests__/signedInBackend'
import type { SyncState } from '../../../../replica/syncContext'
import { forgetTableState, serveTableState } from '../../../../replica/tableState'

/** `homebrew.status` for a pattern that is not homebrew. */
const NOT_LISTED = { listed: false, hidden: false, reported: false, mine: false, admin: false }

// Module scope, before the imports below — see `serverMock.ts`. The mock
// answers only the Games list; the router and sign-in are stand-ins.
const serverMocks = await installServerMocks({
  router: true,
})
afterAll(() => serverMocks.restore())

const { SyncContext } = await import('../../../../replica/syncContext')
const { useUnits } = await import('../../../../replica/units')
const { usePatterns } = await import('../../../../replica/collections')
const { PublicSheetView } = await import('../../../sheet/PublicSheetView')
const { usePageCredit } = await import('../../../../stores/pageCredit')

withSignedInBackend()
withWorkerRoutes()

const PAGE = sharedPaths.sheet('pattern', 'pat-tow-rig')
const STATUS = sharedPaths.homebrew('pat-tow-rig')

const CONNECTED: SyncState = {
  status: 'live',
  canWrite: true,
  outdated: false,
}
const SIGNED_OUT: SyncState = { ...CONNECTED, status: 'signedOut', canWrite: false }

const body = {
  id: 'pat-tow-rig',
  schemaVersion: 1,
  name: 'Tow Rig',
  chassisRef: 'scrapper',
  systems: ['rigging-arm', 'transport-hold'],
  modules: ['comms-module'],
  cargoLots: [],
  notes: 'Rig first, rivet later.',
  createdAt: FIXTURE_NOW,
}

function answer(over: Record<string, unknown> = {}) {
  return {
    body,
    madeBy: 'alxjrvs',
    sharedAt: Date.UTC(2026, 9, 9),
    builtCount: 3,
    mine: false,
    visibility: null,
    ...over,
  }
}

/** Drive the store's server-first write (stub commit, then memory) to completion. */
async function settle(done: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !done(); i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
  }
}

function renderAs(connection: SyncState) {
  return render(
    <SyncContext.Provider value={connection}>
      <PublicSheetView kind="pattern" appId="pat-tow-rig" />
    </SyncContext.Provider>
  )
}

beforeEach(() => {
  useUnits.setState({
    mechs: [],
    hydrated: { pilots: true, mechs: true, crawlers: true, npcs: true, softLinks: true },
  })
  usePatterns.setState({ mechPatterns: [], hydrated: true })
  serverMocks.navigations.length = 0
  forgetTableState()
  acceptingRooms()
})

describe('a shared pattern reads like the book and says a player made it', () => {
  test('laid out as the book pattern page: HOMEBREW stamp, the maker credited on the foot, their notes as its description', () => {
    answerRoutes({ [STATUS]: NOT_LISTED, [PAGE]: answer() })
    const { container } = renderAs(SIGNED_OUT)

    expect(screen.getByRole('heading', { level: 1, name: /Tow Rig/ })).toBeTruthy()
    // The book page's band, not a hatched one: the stamp says it instead.
    expect(container.querySelector('[data-user-made]')).toBeNull()
    expect(container.querySelector('.su-entity-stamps')?.textContent).toContain('Homebrew')
    expect(screen.getByRole('link', { name: /Scrapper/ })).toBeTruthy()
    // The notes lead the pattern as a book pattern's prose does.
    expect(container.querySelector('.su-entity-page__opening')?.textContent).toContain(
      'Rig first, rivet later.'
    )
    expect(usePageCredit.getState().credit).toBe('Homebrew // Made by alxjrvs')
    expect(screen.getByText('3 mechs built from it')).toBeTruthy()
  })

  test('the foot forgets the credit once the page is gone', () => {
    answerRoutes({ [STATUS]: NOT_LISTED, [PAGE]: answer() })
    const { unmount } = renderAs(SIGNED_OUT)
    unmount()
    expect(usePageCredit.getState().credit).toBeUndefined()
  })

  test('the chassis and the loadout come from the reference', () => {
    answerRoutes({ [STATUS]: NOT_LISTED, [PAGE]: answer() })
    renderAs(SIGNED_OUT)

    expect(screen.getAllByText('Scrapper chassis').length).toBeGreaterThan(0)
    for (const part of ['Rigging Arm', 'Transport Hold', 'Comms Module']) {
      expect(screen.getAllByText(part).length).toBeGreaterThan(0)
    }
  })

  test('signed out, it offers sign-in rather than a build that would be refused', () => {
    answerRoutes({ [STATUS]: NOT_LISTED, [PAGE]: answer() })
    renderAs(SIGNED_OUT)

    expect(screen.queryByRole('button', { name: /^Build With This/ })).toBeNull()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy()
  })

  test('a pattern the reader may not see is not there at all', () => {
    answerRoutes({ [STATUS]: NOT_LISTED, [PAGE]: null })
    renderAs(SIGNED_OUT)
    expect(screen.getByText(/pattern isn['’]t available/i)).toBeTruthy()
  })
})

describe('signed in', () => {
  test('Build With This makes a fresh mech that records its source, and opens it', async () => {
    answerRoutes({ [STATUS]: NOT_LISTED, [PAGE]: answer() })
    renderAs(CONNECTED)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Build With This: a mech from / }))
    })
    await settle(() => serverMocks.navigations.length > 0)

    const [mech] = useUnits.getState().mechs
    expect(mech).toMatchObject({ name: 'Tow Rig', sourcePattern: 'pat-tow-rig', cargoLots: [] })
    expect(serverMocks.navigations).toEqual([{ to: '/mechs/$id', params: { id: mech?.id } }])
  })

  test('Copy to my shelf saves it under a new id', async () => {
    answerRoutes({ [STATUS]: NOT_LISTED, [PAGE]: answer() })
    renderAs(CONNECTED)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Make a copy' }))
    })
    await settle(() => usePatterns.getState().mechPatterns.length > 0)

    const [copy] = usePatterns.getState().mechPatterns
    expect(copy?.name).toBe('Tow Rig')
    expect(copy?.id).not.toBe('pat-tow-rig')
  })

  test('its maker keeps the copy action, and is told who can see it', () => {
    answerRoutes({ [STATUS]: NOT_LISTED, [PAGE]: answer({ mine: true, visibility: 'link' }) })
    renderAs(CONNECTED)

    expect(screen.getByRole('button', { name: 'Make a copy' })).toBeTruthy()
    expect(screen.getByText(/Anyone with the link/)).toBeTruthy()
  })

  test('its maker changes who can see it from the Share dialog every player thing opens', async () => {
    answerRoutes({ [STATUS]: NOT_LISTED, [PAGE]: answer({ mine: true, visibility: 'link' }) })
    setQueryAnswers({ 'games.listMine': [] })
    serveTableState('account', {
      sharing: [
        {
          appId: 'pat-tow-rig',
          body: {
            visibility: 'link',
            gameId: null,
            gameName: null,
            builtCount: 3,
            homebrew: false,
          },
        },
      ],
    })
    renderAs(CONNECTED)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Share Tow Rig' }))
    })
    expect(screen.getByRole('group', { name: /who can see it/i })).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: /only me/i }))
    })

    expect(roomActs).toEqual([
      {
        gameId: null,
        name: 'shelf.setPatternVisibility',
        args: { patternId: 'pat-tow-rig', visibility: 'private' },
      },
    ])
  })

  test('a reader who is not its maker is never offered Share', () => {
    answerRoutes({ [STATUS]: NOT_LISTED, [PAGE]: answer({ visibility: null }) })
    renderAs(CONNECTED)
    expect(screen.queryByRole('button', { name: 'Share Tow Rig' })).toBeNull()
  })

  test('the stat column spells stat names out', () => {
    answerRoutes({ [STATUS]: NOT_LISTED, [PAGE]: answer() })
    renderAs(SIGNED_OUT)
    expect(screen.getByText('Structure Points')).toBeTruthy()
    expect(screen.queryByText('Structure Pts.')).toBeNull()
  })
})
