import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

/**
 * Copying from the Starter Set, signed in. "Make a copy" is one act with one
 * name, on a sheet and on each line of the Starter Set page: one confirm that
 * names where the copy goes (a menu of where first, for a player in a Game), a
 * pilot with their mech already assigned, and the player lands on the copy.
 * The template is left as it was.
 *
 * Queries are answered **by name** — see `serverMock.ts`.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { installServerMocks, setQueryAnswers } from '../../../components/__tests__/serverMock'

// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs.
const serverMocks = await installServerMocks({
  // The store commits the copy to the server first; the router records where
  // the copy lands.
  router: 'probed',
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

const IN_A_GAME = {
  'games.listMine': [
    { _id: 'g1', name: 'The Long Haul', mediator: false, organizer: false, tableRunner: false },
  ],
}

beforeEach(async () => {
  setQueryAnswers(IN_A_GAME)
  serverMocks.navigations.length = 0
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
  test('one confirm naming the Training Bay; the pilot arrives with their mech assigned, and you land on the copy', async () => {
    // In no Game there is one place to copy to, so the button asks at once.
    setQueryAnswers({ 'games.listMine': [] })
    const template = structuredClone(STARTER_PILOTS[0])
    renderBonesaw()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Make a copy' }))
    })
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('Copy Bonesaw and Scrapper to your Training Bay?')
    expect(dialog.textContent).toContain('the Mech already assigned')
    expect(dialog.textContent).toContain('stays as Leyline Press published it')
    expect(useUnits.getState().list('pilot')).toHaveLength(0)

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Make a copy' }))
    })
    await waitFor(() => expect(serverMocks.navigations).toHaveLength(1))

    const [copy] = useUnits.getState().list('pilot')
    expect(copy?.name).toBe('Bonesaw')
    expect(copy?.gameId).toBeNull()
    expect(copy?.seedRef).toBe('starter-pilot-bonesaw')
    expect(copy?.id).not.toBe('starter-pilot-bonesaw')
    // Their mech came too, a build of the player's own, assigned to the copy.
    const [mech] = useUnits.getState().list('mech')
    expect(mech?.name).toBe('Scrapper')
    expect(mech?.gameId).toBeNull()
    expect(useUnits.getState().softLinks.map((l) => [l.type, l.from.id, l.to.id])).toEqual([
      ['mech-to-pilot', mech?.id as string, copy?.id as string],
    ])
    // The player lands on the copy.
    expect(serverMocks.navigations).toEqual([{ to: `/pilots/${copy?.id}` }])
    // The template is untouched.
    expect(STARTER_PILOTS[0]).toEqual(template)
  })

  test('a player in a Game picks where on the sheet too, under the same name', async () => {
    renderBonesaw()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Make a copy' }))
    })
    const options = within(screen.getByRole('menu'))
      .getAllByRole('menuitem')
      .map((o) => o.textContent)
    expect(options).toEqual(['Training Bay', 'The Long Haul'])
  })
})

describe('Make a copy on the Starter Set page', () => {
  function renderPage() {
    render(
      <SyncContext.Provider value={CONNECTED}>
        <StarterSetRoster headingLevel="h1" />
      </SyncContext.Provider>
    )
  }

  async function openCopy(name: string): Promise<HTMLElement> {
    await act(async () => {
      fireEvent.click(
        screen.getAllByRole('button', { name: `Make a copy of ${name}` })[0] as HTMLElement
      )
    })
    return screen.getByRole('menu')
  }

  test('every line says “Make a copy”, as the sheet does, outside the sheet’s link', () => {
    renderPage()
    expect(screen.queryByRole('button', { name: 'Copy Bonesaw to…' })).toBeNull()
    const trigger = screen.getAllByRole('button', {
      name: 'Make a copy of Bonesaw',
    })[0] as HTMLElement
    expect(trigger.textContent).toBe('Make a copy')
    const line = trigger.closest('tr') as HTMLElement
    const sheet = within(line).getByRole('link', { name: 'Bonesaw' })
    expect(sheet.getAttribute('href')).toBe('/starter/pilot/starter-pilot-bonesaw')
    expect(sheet.contains(trigger)).toBe(false)
  })

  test('offers Training Bay and every Game the player is in', async () => {
    renderPage()
    const menu = await openCopy('Bonesaw')
    const options = within(menu)
      .getAllByRole('menuitem')
      .map((o) => o.textContent)
    expect(options).toEqual(['Training Bay', 'The Long Haul'])
  })

  test('with only the Training Bay to copy to, it is a button: no menu of one', async () => {
    setQueryAnswers({ 'games.listMine': [] })
    renderPage()
    await act(async () => {
      fireEvent.click(
        screen.getAllByRole('button', { name: 'Make a copy of Bonesaw' })[0] as HTMLElement
      )
    })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('alertdialog').textContent).toContain(
      'Copy Bonesaw and Scrapper to your Training Bay?'
    )
  })

  test('asks once, then makes Bonesaw and their mech builds of the player’s own in the chosen Game', async () => {
    renderPage()

    const menu = await openCopy('Bonesaw')
    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'The Long Haul' }))
    })
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('Copy Bonesaw and Scrapper to The Long Haul?')

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Make a copy' }))
    })
    await waitFor(() => expect(serverMocks.navigations).toHaveLength(1))
    expect(useUnits.getState().list('pilot')[0]?.gameId).toBe('g1')
    expect(useUnits.getState().list('mech')[0]?.gameId).toBe('g1')
    expect(useUnits.getState().softLinks).toHaveLength(1)
  })
})
