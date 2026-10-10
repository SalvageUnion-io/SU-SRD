/**
 * The public pattern page, `/p/pattern/:appId` (issue 1276, board P2): reference-
 * styled, plainly user-made, and buildable by a signed-in reader.
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ConnectionState } from '../../../../lib/connection/connectionContext'
import { withSignedInBackend } from '../../../../stores/__tests__/signedInBackend'
import { installConvexMocks, setQueryAnswers } from '../../../__tests__/convexMock'
import { FIXTURE_NOW } from '../../../__tests__/fixtures'

// Module scope, before the imports below — see `convexMock.ts`.
const convexMocks = await installConvexMocks({
  convexClient: { mutation: async () => ({ updatedAt: 1 }) },
  authReact: true,
  router: true,
})
afterAll(() => convexMocks.restore())

const { ConnectionContext } = await import('../../../../lib/connection/connectionContext')
const { useEntityStore } = await import('../../../../stores/entityStore')
const { usePatternStore } = await import('../../../../stores/patternStore')
const { PublicSheetView } = await import('../../../sheet/PublicSheetView')

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

/** Drive the store's server-first write (stub commit, then IndexedDB) to completion. */
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
})

describe('a shared pattern reads like the book and says a player made it', () => {
  test('hatched band, User-made stamp, the maker named, their notes', () => {
    setQueryAnswers({ 'publicSheet:pattern': answer() })
    const { container } = renderAs(SIGNED_OUT)

    expect(screen.getByRole('heading', { level: 1, name: /Tow Rig/ })).toBeTruthy()
    expect(container.querySelector('[data-user-made]')).not.toBeNull()
    expect(screen.getByText('User-made pattern')).toBeTruthy()
    expect(screen.getByRole('note', { name: 'Who made this' }).textContent).toContain(
      'Made by alxjrvs.'
    )
    expect(screen.getByText('Rig first, rivet later.')).toBeTruthy()
    expect(screen.getByText('3 mechs built from it')).toBeTruthy()
  })

  test('the chassis and the loadout come from the reference', () => {
    setQueryAnswers({ 'publicSheet:pattern': answer() })
    renderAs(SIGNED_OUT)

    expect(
      screen.getByText('Stats come from the Scrapper chassis in the Workshop Manual.')
    ).toBeTruthy()
    for (const part of ['Rigging Arm', 'Transport Hold', 'Comms Module']) {
      expect(screen.getAllByText(part).length).toBeGreaterThan(0)
    }
  })

  test('signed out, it offers sign-in rather than a build that would be refused', () => {
    setQueryAnswers({ 'publicSheet:pattern': answer() })
    renderAs(SIGNED_OUT)

    expect(screen.queryByRole('button', { name: 'Build this mech' })).toBeNull()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy()
  })

  test('a pattern the reader may not see is not there at all', () => {
    setQueryAnswers({ 'publicSheet:pattern': null })
    renderAs(SIGNED_OUT)
    expect(screen.getByText(/pattern isn['’]t available/i)).toBeTruthy()
  })
})

describe('signed in', () => {
  test('Build this mech makes a fresh mech that records its source, and opens it', async () => {
    setQueryAnswers({ 'publicSheet:pattern': answer() })
    renderAs(CONNECTED)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Build this mech' }))
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
      fireEvent.click(screen.getByRole('button', { name: 'Copy to my shelf' }))
    })
    await settle(() => usePatternStore.getState().mechPatterns.length > 0)

    const [copy] = usePatternStore.getState().mechPatterns
    expect(copy?.name).toBe('Tow Rig')
    expect(copy?.id).not.toBe('pat-tow-rig')
  })

  test('its maker gets no copy of their own, and is told who can see it', () => {
    setQueryAnswers({ 'publicSheet:pattern': answer({ mine: true, visibility: 'link' }) })
    renderAs(CONNECTED)

    expect(screen.queryByRole('button', { name: 'Copy to my shelf' })).toBeNull()
    expect(screen.getByText(/Anyone with the link/)).toBeTruthy()
  })
})
