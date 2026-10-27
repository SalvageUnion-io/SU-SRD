import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

/**
 * Copying from the Starter Set, signed in. On a sheet, "Make a copy" asks
 * first and makes a build of the player's own on their shelf; on the Starter
 * Set page, "Copy to…" offers the shelf and the player's Games too. Either way
 * the template is left as it was.
 *
 * Queries are answered **by name** — see `serverMock.ts`.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { installServerMocks, setQueryAnswers } from '../../../components/__tests__/serverMock'

// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs.
const serverMocks = await installServerMocks({
  // The store commits the copy to the server first.
})

const { SyncContext } = await import('../../../replica/syncContext')
const { hydrateStores } = await import('../../../components/__tests__/hydrateStores')
const { resetStores } = await import('../../../replica/__tests__/resetStores')
const { withSignedInBackend } = await import('../../../replica/__tests__/signedInBackend')
const { useUnits } = await import('../../../replica/units')
const { STARTER_PILOTS } = await import('game-domain/starterSet/starterSet')
const { StarterSheetView } = await import('../StarterSheetView')
const { StarterSetRoster } = await import('../StarterSetRoster')

withSignedInBackend()

afterAll(() => serverMocks.restore())

const CONNECTED = {
  status: 'live' as const,
  canWrite: true,
  outdated: false,
}

beforeEach(async () => {
  setQueryAnswers({
    'games.listMine': [
      { _id: 'g1', name: 'The Long Haul', mediator: false, organizer: false, tableRunner: false },
    ],
  })
  resetStores()
  await hydrateStores()
})

function renderBonesaw() {
  render(
    <SyncContext.Provider value={CONNECTED}>
      <StarterSheetView kind="pilot" id="starter-pilot-bonesaw" />
    </SyncContext.Provider>
  )
}

describe('Make a copy', () => {
  test('asks first, then puts a build of the player’s own in their Training Bay', async () => {
    const template = structuredClone(STARTER_PILOTS[0])
    renderBonesaw()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Make a copy' }))
    })
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('Make a copy of Bonesaw?')
    expect(dialog.textContent).toContain('stays as Leyline Press published it')
    expect(useUnits.getState().list('pilot')).toHaveLength(0)

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Make a copy' }))
    })
    await waitFor(() => expect(useUnits.getState().list('pilot')).toHaveLength(1))

    const [copy] = useUnits.getState().list('pilot')
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
      <SyncContext.Provider value={CONNECTED}>
        <StarterSetRoster headingLevel="h1" />
      </SyncContext.Provider>
    )
  }

  async function openCopyTo(name: string): Promise<HTMLElement> {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: `Copy ${name} to…` }))
    })
    return screen.getByRole('menu')
  }

  test('“Copy to…” is a chip in the Compact’s chip group, outside the sheet’s link', () => {
    renderPage()
    const trigger = screen.getByRole('button', { name: 'Copy Bonesaw to…' })
    expect(trigger.closest('[data-chip-group]')).not.toBeNull()
    const sheet = screen.getByRole('link', { name: 'Read Bonesaw' })
    expect(sheet.contains(trigger)).toBe(false)
  })

  test('offers Training Bay and every Game the player is in', async () => {
    renderPage()
    const menu = await openCopyTo('Bonesaw')
    const options = within(menu)
      .getAllByRole('menuitem')
      .map((o) => o.textContent)
    expect(options).toEqual(['Training Bay', 'The Long Haul'])
  })

  test('asks first, then makes Bonesaw a build of the player’s own in the chosen Game', async () => {
    renderPage()

    const menu = await openCopyTo('Bonesaw')
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'The Long Haul' }))
    })
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('Copy Bonesaw to The Long Haul?')

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Make a copy' }))
    })
    await waitFor(() => expect(useUnits.getState().list('pilot')).toHaveLength(1))
    expect(useUnits.getState().list('pilot')[0]?.gameId).toBe('g1')
  })
})
