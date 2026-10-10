import { afterAll, describe, expect, test } from 'bun:test'
import { render, screen, within } from '@testing-library/react'

/**
 * The Crew tab as a table (board D2, issue 1255): Pilot · HP · AP · Mech ·
 * Status, a ▲ and the word for a crewmate who needs looking at and "Fine" for
 * one who does not, each row a link to the live sheet, and "Copy invite link"
 * under the table.
 */

import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'

const convexMocks = await installConvexMocks({})
afterAll(() => convexMocks.restore())

const { CrewTab } = await import('../CrewTab')
const { ConnectionContext } = await import('../../../lib/connection/connectionContext')

const CONNECTED = {
  mode: 'connected' as const,
  canWrite: true,
  showDisconnectedWarning: false,
  settling: false,
}

const ROOK = {
  pilotId: 'rook',
  name: 'Rook',
  self: true,
  href: '/sheet/pilot/rook',
  where: 'On foot',
  vitals: 'HP 8/10 · AP 3/5',
  hp: '8/10',
  ap: '3/5',
  unit: 'On foot · Scrapper parked',
  mech: 'Scrapper parked',
  mechAttention: false,
  problems: [],
  attention: false,
  resolving: null,
}

const PICKLE = {
  ...ROOK,
  pilotId: 'pickle',
  name: 'Pickle',
  self: false,
  href: '/sheet/pilot/pickle',
  where: 'In Spectrum',
  vitals: 'HP 10/10 · AP 5/5',
  hp: '10/10',
  ap: '5/5',
  unit: 'In Spectrum · SP 6/9',
  mech: 'Spectrum · SP 6/9 · Heat 7/8',
  problems: ['Overheating'],
  attention: true,
  resolving: 'Pickle is resolving Drill',
}

function renderTab() {
  setQueryAnswers({})
  render(
    <ConnectionContext.Provider value={CONNECTED}>
      <CrewTab crew={[ROOK, PICKLE]} gameId={'g1' as never} />
    </ConnectionContext.Provider>
  )
}

describe('the Crew tab', () => {
  test('is a table of the crew, each row a link to the live sheet', () => {
    renderTab()
    const crew = within(screen.getByRole('list', { name: 'Crew' }))
    const rook = crew.getByRole('link', {
      name: 'Rook (you): HP 8/10, AP 3/5, On foot · Scrapper parked, Fine',
    })
    expect(rook.getAttribute('href')).toBe('/sheet/pilot/rook')
    expect(crew.getByText('Fine')).toBeTruthy()
  })

  test('a crewmate who needs looking at gets the ▲ and the word, and their resolve', () => {
    renderTab()
    const pickle = screen.getByRole('link', { name: /^Pickle: HP 10\/10, AP 5\/5/ })
    expect(pickle.textContent).toContain('▲')
    expect(pickle.textContent).toContain('Overheating')
    expect(screen.getByText('Pickle is resolving Drill')).toBeTruthy()
  })

  test('offers "Copy invite link" under the table', () => {
    renderTab()
    expect(screen.getByRole('button', { name: 'Copy invite link' })).toBeTruthy()
  })
})
