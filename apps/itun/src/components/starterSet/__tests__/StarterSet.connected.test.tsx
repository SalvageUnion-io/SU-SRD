import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

/**
 * Copying from the Starter Set, signed in. On a sheet, "Make a copy" asks
 * first and makes a build of the player's own on their shelf; on the Starter
 * Set page, "Copy to…" offers the shelf and the player's Games too. Either way
 * the template is left as it was.
 *
 * Queries are answered **by name** (`getFunctionName`) — see `convexMock.ts`.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'

// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs.
const convexMocks = await installConvexMocks({
  // The store commits the copy to the server first.
  // `upsertByAppId` answers with the row's new version.
  convexClient: { mutation: async () => ({ updatedAt: 1 }) },
})

const { ConnectionContext } = await import('../../../lib/connection/connectionContext')
const { hydrateStores } = await import('../../__tests__/hydrateStores')
const { withSignedInBackend } = await import('../../../stores/__tests__/signedInBackend')
const { useEntityStore } = await import('../../../stores/entityStore')
const db = await import('../../../lib/db/index')
const { STARTER_PILOTS } = await import('../../../lib/starterSet/starterSet')
const { StarterSheetView } = await import('../StarterSheetView')
const { StarterSetRoster } = await import('../StarterSetRoster')

withSignedInBackend()

afterAll(() => convexMocks.restore())

const CONNECTED = {
  mode: 'connected' as const,
  canWrite: true,
  showDisconnectedWarning: false,
  settling: false,
}

beforeEach(async () => {
  setQueryAnswers({
    'games:listMine': [
      { _id: 'g1', name: 'The Long Haul', mediator: false, organizer: false, tableRunner: false },
    ],
  })
  db._resetDbSingleton()
  await db.clearCache()
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, npcs: false, softLinks: false },
  })
  await hydrateStores()
})

function renderBonesaw() {
  render(
    <ConnectionContext.Provider value={CONNECTED}>
      <StarterSheetView kind="pilot" id="starter-pilot-bonesaw" />
    </ConnectionContext.Provider>
  )
}

describe('Make a copy', () => {
  test('asks first, then puts a build of the player’s own on their shelf', async () => {
    const template = structuredClone(STARTER_PILOTS[0])
    renderBonesaw()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Make a copy' }))
    })
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('Make a copy of Bonesaw?')
    expect(dialog.textContent).toContain('stays as Leyline Press published it')
    expect(useEntityStore.getState().list('pilot')).toHaveLength(0)

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Make a copy' }))
    })
    await waitFor(() => expect(useEntityStore.getState().list('pilot')).toHaveLength(1))

    const [copy] = useEntityStore.getState().list('pilot')
    expect(copy?.name).toBe('Bonesaw')
    expect(copy?.gameId).toBeNull()
    expect(copy?.seedRef).toBe('starter-pilot-bonesaw')
    expect(copy?.id).not.toBe('starter-pilot-bonesaw')
    // The template is untouched.
    expect(STARTER_PILOTS[0]).toEqual(template)
  })
})

describe('Copy to… on the Starter Set page', () => {
  function renderPage() {
    render(
      <ConnectionContext.Provider value={CONNECTED}>
        <StarterSetRoster headingLevel="h1" />
      </ConnectionContext.Provider>
    )
  }

  test('offers Shelves and every Game the player is in', () => {
    renderPage()
    const options = within(screen.getByLabelText('Copy Bonesaw to…'))
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(options).toEqual(['Copy to…', 'Shelves', 'The Long Haul'])
  })

  test('asks first, then makes Bonesaw a build of the player’s own in the chosen Game', async () => {
    renderPage()

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Copy Bonesaw to…'), { target: { value: 'game:g1' } })
    })
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('Copy Bonesaw to The Long Haul?')

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Make a copy' }))
    })
    await waitFor(() => expect(useEntityStore.getState().list('pilot')).toHaveLength(1))
    expect(useEntityStore.getState().list('pilot')[0]?.gameId).toBe('g1')
  })
})
