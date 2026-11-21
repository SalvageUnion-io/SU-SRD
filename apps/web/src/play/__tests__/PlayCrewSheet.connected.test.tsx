/**
 * A crewmate's sheet in Play, read off the Game's listing and never adopted
 * into the reader's own builds (ADR-037): the Crew line's overlay
 * (`PlayCrewSheet`, play.md §7) and the sheet pane in a Game
 * (`PlaySheetPane`, play.md §18).
 *
 * The listing is answered by name (`games.listing`, `serverMock.ts`).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { mechFixture, pilotFixture } from '../../components/__tests__/fixtures'
import { installServerMocks, setQueryAnswers } from '../../components/__tests__/serverMock'
import type { SheetChoice } from '../sheetOnScreen.model'

const serverMocks = await installServerMocks()
afterAll(() => serverMocks.restore())

const { PlayCrewSheet } = await import('../PlayCrewSheet')
const { PlaySheetPane } = await import('../PlaySheetPane')
const { useUnits } = await import('../../replica/units')
const { hydrateStores } = await import('../../components/__tests__/hydrateStores')

const ASH = pilotFixture({ id: 'p-ash', name: 'Ash Calloway', callsign: 'Ash', gameId: 'g1' })
const MULE = mechFixture({ id: 'm-mule', name: 'Old Faithful', chassisRef: 'mule', gameId: 'g1' })

const LISTING = {
  pilots: [{ _id: 'p-ash', appId: 'p-ash', ownerId: 'u-ash', body: ASH }],
  mechs: [{ _id: 'm-mule', appId: 'm-mule', ownerId: 'u-ash', body: MULE }],
  crawlers: [],
  npcs: [],
  softLinks: [],
  primaryCrawlerId: null,
}

beforeAll(hydrateStores)
beforeEach(() => setQueryAnswers({ 'games.listing': LISTING }))

const heldHere = () => {
  const { pilots, mechs } = useUnits.getState()
  return [...pilots, ...mechs].map((u) => u.id)
}

describe('a crewmate’s sheet over Play', () => {
  test('closed, it draws nothing and reads nothing', () => {
    render(<PlayCrewSheet gameId="g1" pilotId={null} name="Ash" onClose={() => undefined} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('open, it is their sheet, read-only and said to be, and none of it becomes yours', async () => {
    await act(async () => {
      render(<PlayCrewSheet gameId="g1" pilotId="p-ash" name="Ash" onClose={() => undefined} />)
    })
    const dialog = screen.getByRole('dialog', { name: 'Ash · read-only' })
    expect(dialog.textContent).toContain('Ash Calloway')
    expect(dialog.textContent).toMatch(/You are reading a crewmate/)
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(heldHere()).not.toContain('p-ash')
  })

  test('while the Game’s listing is on its way, it waits', async () => {
    setQueryAnswers({ 'games.listing': undefined })
    await act(async () => {
      render(<PlayCrewSheet gameId="g1" pilotId="p-ash" name="Ash" onClose={() => undefined} />)
    })
    expect(screen.getByRole('dialog', { name: 'Ash · read-only' }).textContent).toMatch(
      /their sheet/
    )
  })

  test('Escape closes it, and Play is told once', async () => {
    const closed: number[] = []
    await act(async () => {
      render(
        <PlayCrewSheet gameId="g1" pilotId="p-ash" name="Ash" onClose={() => closed.push(1)} />
      )
    })
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    })
    expect(closed).toEqual([1])
  })
})

describe('the sheet pane in a Game', () => {
  const THEIR_MECH: SheetChoice = { kind: 'mech', id: 'm-mule', name: 'Old Faithful', yours: false }
  const THEIR_PILOT: SheetChoice = { kind: 'pilot', id: 'p-ash', name: 'Ash', yours: false }

  async function renderPane(
    shown: SheetChoice,
    onShow: (c: SheetChoice) => void = () => undefined
  ) {
    await act(async () => {
      render(
        <PlaySheetPane
          shown={shown}
          sections={[[THEIR_PILOT], [THEIR_MECH]]}
          gameId="g1"
          onShow={onShow}
          onClose={() => undefined}
        />
      )
    })
  }

  test('a crewmate’s unit is read from the Game’s listing, with no way to edit it', async () => {
    await renderPane(THEIR_MECH)
    expect(screen.getAllByText('Old Faithful').length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: 'Edit in Build' })).toBeNull()
    expect(heldHere()).not.toContain('m-mule')
  })

  test('while the listing is on its way, the pane waits', async () => {
    setQueryAnswers({ 'games.listing': undefined })
    await renderPane(THEIR_MECH)
    expect(screen.getByText(/their sheet/)).toBeTruthy()
  })

  test('the picker lists each unit by its kind, and shows the one chosen', async () => {
    const shown: SheetChoice[] = []
    await renderPane(THEIR_MECH, (choice) => shown.push(choice))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Show a sheet' }))
    })
    const pilot = screen.getByRole('menuitem', { name: /Ash/ })
    expect(pilot.textContent).toContain('Pilot')
    expect(pilot.textContent).not.toContain('yours')
    await act(async () => {
      fireEvent.click(pilot)
    })
    expect(shown).toEqual([THEIR_PILOT])
  })

  test('a unit of yours the listing does not hold yet is read from your own builds', async () => {
    const mine = pilotFixture({ id: 'p-mine', name: 'Rosa Vance', callsign: 'Bonesaw' })
    await act(async () => {
      await useUnits.getState().adopt('pilot', mine)
    })
    await renderPane({ kind: 'pilot', id: 'p-mine', name: 'Bonesaw', yours: true })
    expect(screen.getAllByText(/Rosa Vance|Bonesaw/).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Edit in Build' }).getAttribute('href')).toMatch(
      /^\/pilots\/p-mine/
    )
    await act(async () => {
      await useUnits.getState().forget('pilot', 'p-mine')
    })
  })
})
