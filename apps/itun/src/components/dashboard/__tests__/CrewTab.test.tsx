import { afterAll, describe, expect, test } from 'bun:test'
import { render, screen, within } from '@testing-library/react'

/**
 * The Crew tab (board D2): one Row per crewmate, HP and AP as label-first
 * chips, the mech a Token, a ▲ and the word for a crewmate who needs looking
 * at and "Fine" for one who does not, each Row a link to the live sheet, and
 * "Copy invite link" under the list.
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
  unitMech: { name: 'Scrapper', sp: '9/9', boarded: false },
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
  unitMech: { name: 'Spectrum', sp: '6/9', boarded: true },
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

const entryOf = (name: string) => {
  const entry = screen.getByText(name).closest('li')
  if (!(entry instanceof HTMLElement)) throw new Error(`no entry for ${name}`)
  return entry
}

describe('the Crew tab', () => {
  test('is a list of Rows, each a link to the live sheet', () => {
    renderTab()
    const crew = within(screen.getByRole('list', { name: 'Crew' }))
    const rook = crew.getByRole('link', {
      name: 'Rook (you): HP 8/10, AP 3/5, On foot · Scrapper parked, Fine',
    })
    expect(rook.getAttribute('href')).toBe('/sheet/pilot/rook')
    expect(crew.getByText('Fine')).toBeTruthy()
  })

  test('HP and AP are label-first chips; the mech is a Token, parked or aboard', () => {
    renderTab()
    const rook = entryOf('Rook')
    const cells = [...rook.querySelectorAll('.su-entity-row .su-stat-cell')].map(
      (c) => c.textContent
    )
    expect(cells).toEqual(['HP8/10', 'AP3/5'])
    const scrapper = rook.querySelector('.su-entity-token')
    expect(scrapper?.textContent).toContain('Scrapper')
    expect(scrapper?.textContent).toContain('Parked')
    const spectrum = entryOf('Pickle').querySelector('.su-entity-token')
    expect(spectrum?.textContent).toContain('Spectrum')
    expect(spectrum?.textContent).toContain('6/9')
  })

  test('a crewmate who needs looking at gets the ▲ and the word, and their resolve', () => {
    renderTab()
    expect(screen.getByRole('link', { name: /^Pickle: HP 10\/10, AP 5\/5/ })).toBeTruthy()
    const pickle = entryOf('Pickle')
    expect(pickle.textContent).toContain('▲')
    expect(pickle.textContent).toContain('Overheating')
    expect(screen.getByText('Pickle is resolving Drill')).toBeTruthy()
  })

  test('offers "Copy invite link" under the table', () => {
    renderTab()
    expect(screen.getByRole('button', { name: 'Copy invite link' })).toBeTruthy()
  })
})
