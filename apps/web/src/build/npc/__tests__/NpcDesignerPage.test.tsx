/**
 * NpcDesignerPage — `/npcs/new`: one designer, two modes on a tab row.
 *
 * Pins what the band says in each mode (the crawler's name and type when
 * crewing one), that a tab press asks the route to change view rather than
 * switching on its own, and that the preview credits the signed-in player by
 * name — and "you" when there is no account to ask.
 */

import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { crawlerFixture } from '../../../components/__tests__/fixtures'
import { installServerMocks, setQueryAnswers } from '../../../components/__tests__/serverMock'
import {
  accountAnswers,
  accountApiStub,
  accountReads,
  resetAccountApi,
} from '../../../lib/account/__tests__/accountApiStub'
import type { SyncState } from '../../../replica/syncContext'

// Module scope, before the imports below — see `serverMock.ts`.
const serverMocks = await installServerMocks({
  also: { '../../lib/account/accountApi': accountApiStub },
})
afterAll(() => serverMocks.restore())

const { SyncContext } = await import('../../../replica/syncContext')
const { useUnits } = await import('../../../replica/units')
const { NpcDesignerPage } = await import('../NpcDesignerPage')

function connection(status: SyncState['status']): SyncState {
  return {
    status,
    canWrite: status === 'live',
    outdated: false,
  }
}

const TENACITY = crawlerFixture({
  id: 'c1',
  name: '#430 Tenacity',
  gameId: null,
  type: 'augmented',
  crawlerBays: [{ bayRef: 'med-bay' }],
})

type Props = Parameters<typeof NpcDesignerPage>[0]

async function renderPage(props: Partial<Props> = {}, status: SyncState['status'] = 'live') {
  const handlers = {
    onViewChange: mock((_view: string) => {}),
    onCrewSelect: mock(() => {}),
    onCreated: mock(() => {}),
    onCancel: mock(() => {}),
  }
  await act(async () => {
    render(
      <SyncContext.Provider value={connection(status)}>
        <NpcDesignerPage
          view="any"
          crawlerId={undefined}
          slot={undefined}
          {...handlers}
          {...props}
        />
      </SyncContext.Provider>
    )
  })
  return handlers
}

beforeEach(() => {
  useUnits.setState({
    crawlers: [TENACITY],
    npcs: [],
    softLinks: [],
    hydrated: { pilots: true, mechs: true, crawlers: true, npcs: true, softLinks: true },
  })
  resetAccountApi()
  setQueryAnswers({ 'games.listMine': [] })
  accountAnswers.me = { displayName: 'alxjrvs' }
})

describe('Any NPC', () => {
  test('the Denizens band, the template designer, credited to the player', async () => {
    await renderPage()
    expect(screen.getByText('Denizens · New NPC')).toBeTruthy()
    expect(screen.getByText('Design an NPC')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Any NPC' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getAllByText('Made by alxjrvs').length).toBeGreaterThan(0)
  })

  test('pressing the other tab asks the route to change view', async () => {
    const { onViewChange } = await renderPage()
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Crawler crew' }))
    })
    expect(onViewChange.mock.calls[0]?.[0]).toBe('crew')
  })

  test('signed out, nobody is asked who you are', async () => {
    setQueryAnswers({ 'games.listMine': [] })
    await renderPage({}, 'signedOut')
    expect(accountReads.me).toBe(0)
    expect(screen.getAllByText('Made by you').length).toBeGreaterThan(0)
  })
})

describe('Crawler crew', () => {
  test('the band names the crawler and its type, over its crew slots', async () => {
    await renderPage({ view: 'crew', crawlerId: 'c1' })
    expect(screen.getByText('#430 Tenacity · Augmented type · Crew')).toBeTruthy()
    expect(screen.getAllByText('Crawler crew').length).toBeGreaterThan(1)
    expect(screen.getByRole('list', { name: '#430 Tenacity crew slots' })).toBeTruthy()
  })

  test('with no crawler named, the band says so plainly', async () => {
    await renderPage({ view: 'crew', crawlerId: 'gone' })
    expect(screen.getByText('Union crawler · Crew')).toBeTruthy()
    expect(screen.getByText(/That crawler is not one this browser holds/)).toBeTruthy()
  })
})
