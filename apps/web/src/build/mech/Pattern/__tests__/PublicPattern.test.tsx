/**
 * The public pattern page, `/p/pattern/:appId` (board P2): laid out as the
 * book's pattern page, plainly homebrew, and buildable by a signed-in reader.
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { installConvexMocks, setQueryAnswers } from '../../../../components/__tests__/convexMock'
import { FIXTURE_NOW } from '../../../../components/__tests__/fixtures'
import type { ConnectionState } from '../../../../lib/connection/connectionContext'
import { withSignedInBackend } from '../../../../stores/__tests__/signedInBackend'

const visibilityWrites: unknown[] = []

// Module scope, before the imports below — see `convexMock.ts`.
const convexMocks = await installConvexMocks({
  convexClient: { mutation: async () => ({ updatedAt: 1 }) },
  convexReact: {
    useMutation: () => async (args: unknown) => {
      visibilityWrites.push(args)
      return null
    },
  },
  authReact: true,
  router: true,
})
afterAll(() => convexMocks.restore())

const { ConnectionContext } = await import('../../../../lib/connection/connectionContext')
const { useEntityStore } = await import('../../../../stores/entityStore')
const { usePatternStore } = await import('../../../../stores/patternStore')
const { PublicSheetView } = await import('../../../sheet/PublicSheetView')
const { usePageFoot } = await import('../../../../lib/pageFoot')

withSignedInBackend()

const CONNECTED: ConnectionState = {
  mode: 'connected',
  canWrite: true,
  showDisconnectedWarning: false,
  settling: false,
}
const SIGNED_OUT: ConnectionState = { ...CONNECTED, mode: 'solo', canWrite: false }

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

function renderAs(connection: ConnectionState) {
  return render(
    <ConnectionContext.Provider value={connection}>
      <PublicSheetView kind="pattern" appId="pat-tow-rig" />
    </ConnectionContext.Provider>
  )
}

beforeEach(() => {
  useEntityStore.setState({
    mechs: [],
    hydrated: { pilots: true, mechs: true, crawlers: true, npcs: true, softLinks: true },
  })
  usePatternStore.setState({ mechPatterns: [], hydrated: true })
  convexMocks.navigations.length = 0
  visibilityWrites.length = 0
})

describe('a shared pattern reads like the book and says a player made it', () => {
  test('laid out as the book pattern page: HOMEBREW stamp, the maker credited on the foot, their notes as its description', () => {
    setQueryAnswers({ 'publicSheet:pattern': answer() })
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
    expect(usePageFoot.getState().credit).toBe('Homebrew // Made by alxjrvs')
    expect(screen.getByText('3 mechs built from it')).toBeTruthy()
  })

  test('the foot forgets the credit once the page is gone', () => {
    setQueryAnswers({ 'publicSheet:pattern': answer() })
    const { unmount } = renderAs(SIGNED_OUT)
    unmount()
    expect(usePageFoot.getState().credit).toBeUndefined()
  })

  test('the chassis and the loadout come from the reference', () => {
    setQueryAnswers({ 'publicSheet:pattern': answer() })
    renderAs(SIGNED_OUT)

    expect(screen.getAllByText('Scrapper chassis').length).toBeGreaterThan(0)
    for (const part of ['Rigging Arm', 'Transport Hold', 'Comms Module']) {
      expect(screen.getAllByText(part).length).toBeGreaterThan(0)
    }
  })

  test('signed out, it offers sign-in rather than a build that would be refused', () => {
    setQueryAnswers({ 'publicSheet:pattern': answer() })
    renderAs(SIGNED_OUT)

    expect(screen.queryByRole('button', { name: /^Build With This/ })).toBeNull()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy()
  })

  test('a pattern the reader may not see is not there at all', () => {
    setQueryAnswers({ 'publicSheet:pattern': null })
    renderAs(SIGNED_OUT)
    expect(screen.getByText(/pattern isn['’]t available/i)).toBeTruthy()
  })
})

describe('signed in', () => {
  test('Build With This makes a fresh mech that records its source, and opens it', async () => {
    setQueryAnswers({ 'publicSheet:pattern': answer() })
    renderAs(CONNECTED)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Build With This: a mech from / }))
    })
    await settle(() => convexMocks.navigations.length > 0)

    const [mech] = useEntityStore.getState().mechs
    expect(mech).toMatchObject({ name: 'Tow Rig', sourcePattern: 'pat-tow-rig', cargoLots: [] })
    expect(convexMocks.navigations).toEqual([
      { to: '/sheet/$kind/$id', params: { kind: 'mech', id: mech?.id } },
    ])
  })

  test('Copy to my shelf saves it under a new id', async () => {
    setQueryAnswers({ 'publicSheet:pattern': answer() })
    renderAs(CONNECTED)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Make a copy' }))
    })
    await settle(() => usePatternStore.getState().mechPatterns.length > 0)

    const [copy] = usePatternStore.getState().mechPatterns
    expect(copy?.name).toBe('Tow Rig')
    expect(copy?.id).not.toBe('pat-tow-rig')
  })

  test('its maker keeps the copy action, and is told who can see it', () => {
    setQueryAnswers({ 'publicSheet:pattern': answer({ mine: true, visibility: 'link' }) })
    renderAs(CONNECTED)

    expect(screen.getByRole('button', { name: 'Make a copy' })).toBeTruthy()
    expect(screen.getByText(/Anyone with the link/)).toBeTruthy()
  })

  test('its maker changes who can see it from the Share dialog every player thing opens', async () => {
    setQueryAnswers({
      'publicSheet:pattern': answer({ mine: true, visibility: 'link' }),
      'shelf:patternSharing': [
        { appId: 'pat-tow-rig', visibility: 'link', gameId: null, gameName: null, builtCount: 3 },
      ],
      'games:listMine': [],
    })
    renderAs(CONNECTED)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Share Tow Rig' }))
    })
    expect(screen.getByRole('group', { name: /who can see it/i })).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: /only me/i }))
    })

    expect(visibilityWrites).toEqual([{ patternId: 'pat-tow-rig', visibility: 'private' }])
  })

  test('a reader who is not its maker is never offered Share', () => {
    setQueryAnswers({ 'publicSheet:pattern': answer({ visibility: null }) })
    renderAs(CONNECTED)
    expect(screen.queryByRole('button', { name: 'Share Tow Rig' })).toBeNull()
  })

  test('the stat column spells stat names out', () => {
    setQueryAnswers({ 'publicSheet:pattern': answer() })
    renderAs(SIGNED_OUT)
    expect(screen.getByText('Structure Points')).toBeTruthy()
    expect(screen.queryByText('Structure Pts.')).toBeNull()
  })
})
