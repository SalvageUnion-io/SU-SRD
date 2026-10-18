/**
 * CrewPatterns — patterns crewmates shared with your Games, under your own.
 *
 * Pins that each readable pattern opens its page and says who made it and
 * where it was shared, that a row this app cannot read (a bad body, or a
 * chassis it does not know) is left out rather than breaking the list, and
 * that with nothing to show — or signed out, with nobody to ask — the section
 * is not there at all.
 */

import { afterAll, describe, expect, test } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import type { ConnectionState } from '../../../../lib/connection/connectionContext'
import { installConvexMocks, queryCalls, setQueryAnswers } from '../../../../components/__tests__/convexMock'
import { FIXTURE_NOW } from '../../../../components/__tests__/fixtures'

// Module scope, before the imports below — see `convexMock.ts`.
const convexMocks = await installConvexMocks()
afterAll(() => convexMocks.restore())

const { ConnectionContext } = await import('../../../../lib/connection/connectionContext')
const { CrewPatterns } = await import('../CrewPatterns')

function connection(mode: ConnectionState['mode']): ConnectionState {
  return { mode, canWrite: mode === 'connected', showDisconnectedWarning: false, settling: false }
}

function patternBody(name: string, chassisRef = 'mule') {
  return {
    id: `body-${name}`,
    schemaVersion: 1,
    name,
    chassisRef,
    systems: [],
    modules: [],
    cargoLots: [],
    createdAt: FIXTURE_NOW,
  }
}

async function renderCrew(mode: ConnectionState['mode'] = 'connected') {
  await act(async () => {
    render(
      <ConnectionContext.Provider value={connection(mode)}>
        <CrewPatterns />
      </ConnectionContext.Provider>
    )
  })
}

describe('CrewPatterns', () => {
  test('each shared pattern opens its page, naming its maker and Game', async () => {
    setQueryAnswers({
      'shelf:crewPatterns': [
        { appId: 'pat-a', body: patternBody('Brawler'), madeBy: 'Sam', gameName: 'Tenacity' },
        // Unreadable rows are skipped, not fatal.
        { appId: 'pat-b', body: { name: 7 }, madeBy: 'Sam', gameName: 'Tenacity' },
        {
          appId: 'pat-c',
          body: patternBody('Ghost', 'no-such-chassis'),
          madeBy: 'Sam',
          gameName: 'Tenacity',
        },
      ],
    })
    await renderCrew()
    expect(screen.getByText('Shared by your crew')).toBeTruthy()
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    const link = screen.getByRole('link', { name: 'Brawler, made by Sam, shared in Tenacity' })
    expect(link.getAttribute('href')).toBe('/p/pattern/pat-a')
  })

  test('with nothing shared, the section is not there', async () => {
    setQueryAnswers({ 'shelf:crewPatterns': [] })
    await renderCrew()
    expect(screen.queryByText('Shared by your crew')).toBeNull()
  })

  test('signed out, nobody is asked and nothing is shown', async () => {
    setQueryAnswers({})
    await renderCrew('solo')
    expect(queryCalls()).toHaveLength(0)
    expect(screen.queryByText('Shared by your crew')).toBeNull()
  })
})
