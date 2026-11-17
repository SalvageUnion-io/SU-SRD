/**
 * The sheet pane (play.md §18): a companion's card read off its host, with
 * Edit in Build on the host's sheet and × back to Actions.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { Pilot } from 'game-domain/schemas/pilot'
import { pilotFixture } from '../../components/__tests__/fixtures'
import type { SheetChoice } from '../sheetOnScreen.model'

const { useUnits } = await import('../../replica/units')
const { hydrateStores } = await import('../../components/__tests__/hydrateStores')
const { PlaySheetPane } = await import('../PlaySheetPane')

const pilot = {
  ...pilotFixture({ id: 'pane-wren', name: 'Wren', equipment: ['mecha-companion'] }),
  partners: [
    {
      id: 'pt-rex',
      hostRef: 'mecha-companion',
      hostSchema: 'equipment',
      name: 'Rex',
      systems: [],
      modules: [],
      conditions: [],
    },
  ],
} as Pilot

const REX: SheetChoice = {
  kind: 'partner',
  id: 'pt-rex',
  name: 'Rex',
  yours: true,
  host: { kind: 'pilot', id: 'pane-wren' },
}

beforeAll(async () => {
  await hydrateStores()
  await useUnits.getState().adopt('pilot', pilot)
})

afterAll(async () => {
  await useUnits.getState().forget('pilot', 'pane-wren')
})

describe('PlaySheetPane — a companion (play.md §18)', () => {
  test('its card, read-only, Edit in Build on its host, × closes', async () => {
    const closed: number[] = []
    await act(async () => {
      render(
        <PlaySheetPane
          shown={REX}
          sections={[[REX]]}
          gameId={null}
          onShow={() => undefined}
          onClose={() => closed.push(1)}
        />
      )
    })
    expect(screen.getAllByText('Rex').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Edit in Build' }).getAttribute('href')).toMatch(
      /^\/pilots\/pane-wren/
    )
    expect(screen.queryByRole('textbox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Back to Actions' }))
    expect(closed).toEqual([1])
  })
})
